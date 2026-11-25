import prisma, { Prisma } from "@freenary/db";
import { Data, Effect, Match } from "effect";

import { matchInternalTransfers } from "../categorisation/internal-transfer";
import { deriveMerchantKey } from "../categorisation/merchant-key";
import { categoriseAfterSync } from "../categorisation/run";
import { refreshExchangeRatesNow } from "../fx/rates";
import { getProvider } from "../providers/registry";
import type {
  BankingProvider,
  ProviderAccount,
  ProviderBalance,
  ProviderHolding,
  ProviderTransaction,
  ProviderUserSession,
} from "../providers/types";
import { accountTypeRule } from "./account-types";
import { findProviderUser } from "./bank-provider-user";
import {
  BudgetPipelineFailed,
  claimSyncRun,
  createSyncReporter,
  reportPipelineFailure,
} from "./sync-progress";
import type { BudgetPipelineReason, SyncReporter } from "./sync-progress";

interface SyncAccount {
  id: string;
  providerAccountId: string;
  type: string;
  currency: string | null;
}

export interface ConnectionWithAccounts {
  id: string;
  provider: string;
  providerSessionId: string;
  institutionName: string;
  institutionCountry: string | null;
  institutionBic: string | null;
  institutionGroup: string | null;
  status: string;
  lastSyncedAt: Date | null;
  accounts: SyncAccount[];
}

interface SyncWindow {
  dateFrom: string;
  dateTo: string;
}

export interface ConnectionSyncContext {
  connection: ConnectionWithAccounts;
  deleteTransactions: (
    where: Prisma.TransactionWhereInput
  ) => Promise<{ count: number }>;
  provider: BankingProvider;
  reporter: SyncReporter;
  user: ProviderUserSession | null;
  window: SyncWindow;
}

interface AccountSyncContext extends ConnectionSyncContext {
  account: SyncAccount;
}

type SyncScope =
  | { readonly kind: "account"; readonly providerAccountId: string }
  | { readonly kind: "connection"; readonly institutionName: string };

class BankSyncFailed extends Data.TaggedError("BankSyncFailed")<{
  readonly detail: string;
  readonly needsReconnect: boolean;
  readonly scope: SyncScope;
}> {
  override get message(): string {
    return Match.value(this.scope).pipe(
      Match.discriminatorsExhaustive("kind")({
        account: (scope) =>
          `Account ${scope.providerAccountId}: ${this.detail}`,
        connection: (scope) =>
          `Connection ${scope.institutionName}: ${this.detail}`,
      })
    );
  }
}

const PROVIDER_SERVED_HISTORY_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PENDING = "PDNG";
const REJECTED = "RJCT";

const accountFailure =
  (account: SyncAccount, provider: BankingProvider) =>
  (cause: unknown): BankSyncFailed =>
    new BankSyncFailed({
      detail: cause instanceof Error ? cause.message : "Unknown account error",
      needsReconnect: provider.needsReconnect(cause),
      scope: { kind: "account", providerAccountId: account.providerAccountId },
    });

export const connectionFailure =
  (connection: ConnectionWithAccounts, provider: BankingProvider | null) =>
  (cause: unknown): BankSyncFailed =>
    new BankSyncFailed({
      detail:
        cause instanceof Error ? cause.message : "Unknown connection error",
      needsReconnect: provider?.needsReconnect(cause) ?? false,
      scope: {
        institutionName: connection.institutionName,
        kind: "connection",
      },
    });

const mapOriginalAmount = (tx: ProviderTransaction) => ({
  originalAmount: tx.originalAmountMinor ?? null,
  originalCurrency: tx.originalCurrency ?? null,
});

// SAFETY: Prisma requires DbNull (not plain null) to clear a Json? column
const mapProviderFields = (tx: ProviderTransaction) => ({
  amount: tx.amountMinor,
  balanceAfterTransaction: tx.balanceAfterMinor ?? null,
  bankTransactionCode: tx.bankTransactionDescription ?? null,
  bankTransactionFamilyCode: tx.bankTransactionFamilyCode ?? null,
  bankTransactionSubCode: tx.bankTransactionSubCode ?? null,
  counterpartyName: tx.creditorName ?? tx.debtorName ?? null,
  creditorAccountIban: tx.creditorIban ?? null,
  creditorAgentBic: tx.creditorAgentBic ?? null,
  creditorCountry: tx.creditorCountry ?? null,
  creditorIdentifications: tx.creditorIdentifications
    ? (tx.creditorIdentifications.map(({ identification, schemeName }) => ({
        identification,
        schemeName,
      })) as Prisma.InputJsonValue)
    : Prisma.DbNull,
  creditorTown: tx.creditorTown ?? null,
  currency: tx.currency,
  date: new Date(tx.bookingDate),
  debtorAccountIban: tx.debtorIban ?? null,
  description: tx.remittanceLines.join(" "),
  exchangeRate: tx.exchangeRate ?? null,
  merchantCategoryCode: tx.merchantCategoryCode ?? null,
  ...mapOriginalAmount(tx),
  psuNote: tx.psuNote ?? null,
  referenceNumber: tx.referenceNumber ?? null,
  referenceNumberScheme: tx.referenceNumberScheme ?? null,
  remittanceLines: tx.remittanceLines,
  status: tx.status,
  transactionDate: tx.transactionDate ? new Date(tx.transactionDate) : null,
  valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
});

const deriveKey = (
  tx: ProviderTransaction,
  connection: ConnectionWithAccounts
) =>
  deriveMerchantKey({
    amountMinor: tx.amountMinor,
    bankTransactionFamilyCode: tx.bankTransactionFamilyCode,
    bankTransactionSubCode: tx.bankTransactionSubCode,
    country: connection.institutionCountry,
    creditorIban: tx.creditorIban,
    creditorIdentifications: tx.creditorIdentifications,
    creditorName: tx.creditorName,
    debtorName: tx.debtorName,
    institutionBic: connection.institutionBic,
    institutionGroup: connection.institutionGroup,
    institutionName: connection.institutionName,
    remittanceLines: tx.remittanceLines,
  });

const transactionFields = (
  tx: ProviderTransaction,
  connection: ConnectionWithAccounts
) => {
  const keyResult = deriveKey(tx, connection);

  return {
    ...mapProviderFields(tx),
    channel: keyResult.channel,
    intermediaryName: keyResult.intermediaryName,
    merchantKey: keyResult.merchantKey || null,
    normalisedDescriptor: keyResult.normalisedDescriptor || null,
    transactionPath: keyResult.path,
  };
};

type TransactionFields = ReturnType<typeof transactionFields>;

type TransactionColumn = keyof TransactionFields;

const NON_TEXT_COLUMN_TYPES: Partial<Record<TransactionColumn, string>> = {
  amount: "bigint",
  balanceAfterTransaction: "bigint",
  creditorIdentifications: "jsonb",
  date: "timestamp(3)",
  originalAmount: "bigint",
  remittanceLines: "text[]",
  transactionDate: "timestamp(3)",
  valueDate: "timestamp(3)",
};

const TRANSACTION_BATCH_SIZE = 500;

const quoted = (column: string) => Prisma.raw(`"${column}"`);

// SAFETY: a timestamp column ignores the trailing Z, so the instant is stored in UTC like Prisma's own writes
const sqlCell = (
  column: TransactionColumn,
  value: TransactionFields[TransactionColumn]
): Prisma.Sql => {
  const type = NON_TEXT_COLUMN_TYPES[column] ?? "text";

  if (value === Prisma.DbNull || value === null) {
    return Prisma.sql`NULL::${Prisma.raw(type)}`;
  }

  if (value instanceof Date) {
    return Prisma.sql`${value.toISOString()}::${Prisma.raw(type)}`;
  }

  return Prisma.sql`${type === "jsonb" ? JSON.stringify(value) : value}::${Prisma.raw(type)}`;
};

const writeTransactionBatch = async (
  accountId: string,
  rows: readonly { fields: TransactionFields; providerTransactionId: string }[]
): Promise<void> => {
  const [first] = rows;

  if (!first) {
    return;
  }

  // SAFETY: Object.keys of a TransactionFields lists TransactionColumns
  const columns = Object.keys(first.fields) as TransactionColumn[];

  const resolutionIsStale = Prisma.sql`NOT t."categoryOverride" AND NOT t."isInternalTransfer" AND t."merchantKey" IS DISTINCT FROM v."merchantKey"`;

  const updated = await prisma.$queryRaw<{ providerTransactionId: string }[]>`
    UPDATE "transaction" AS t
    SET ${Prisma.join(
      columns.map(
        (column) => Prisma.sql`${quoted(column)} = v.${quoted(column)}`
      )
    )},
      "resolvedCategory" = CASE WHEN ${resolutionIsStale} THEN NULL ELSE t."resolvedCategory" END,
      "resolutionStage" = CASE WHEN ${resolutionIsStale} THEN NULL ELSE t."resolutionStage" END,
      "resolutionConfidence" = CASE WHEN ${resolutionIsStale} THEN NULL ELSE t."resolutionConfidence" END
    FROM (VALUES ${Prisma.join(
      rows.map(
        ({ fields, providerTransactionId }) =>
          Prisma.sql`(${providerTransactionId}::text, ${Prisma.join(
            columns.map((column) => sqlCell(column, fields[column]))
          )})`
      )
    )}) AS v ("providerTransactionId", ${Prisma.join(columns.map(quoted))})
    WHERE t."accountId" = ${accountId}
      AND t."providerTransactionId" = v."providerTransactionId"
    RETURNING t."providerTransactionId"
  `;

  const existing = new Set(updated.map((row) => row.providerTransactionId));

  await prisma.transaction.createMany({
    data: rows.flatMap(({ fields, providerTransactionId }) =>
      existing.has(providerTransactionId)
        ? []
        : [
            {
              ...fields,
              accountId,
              category: null,
              categoryOverride: false,
              providerTransactionId,
            },
          ]
    ),
    skipDuplicates: true,
  });
};

const upsertTransactionsInBatches = async (
  accountId: string,
  transactions: readonly ProviderTransaction[],
  connection: ConnectionWithAccounts,
  reporter: SyncReporter
): Promise<void> => {
  const lastCopyPerId = [
    ...new Map(
      transactions.map((tx) => [
        tx.providerTransactionId,
        {
          fields: transactionFields(tx, connection),
          providerTransactionId: tx.providerTransactionId,
        },
      ])
    ).values(),
  ];

  for (
    let start = 0;
    start < lastCopyPerId.length;
    start += TRANSACTION_BATCH_SIZE
  ) {
    const batch = lastCopyPerId.slice(start, start + TRANSACTION_BATCH_SIZE);

    // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
    await writeTransactionBatch(accountId, batch);
    // eslint-disable-next-line no-await-in-loop -- the reporter writes at most once a second; the rest resolve immediately
    await reporter.transactionsImported(batch.length);
  }
};

export const reportedBalances = (
  account: ProviderAccount
): ProviderBalance[] | null => {
  if (account.balances) {
    return [
      ...new Map(
        account.balances.map((balance) => [balance.currency, balance])
      ).values(),
    ];
  }

  const { balanceAt, balanceMinor, currency } = account;

  if (currency === undefined || balanceMinor === undefined) {
    return null;
  }

  return [{ balanceAt, balanceMinor, currency }];
};

const toBalanceAt = (balanceAt: string | undefined): Date | null =>
  balanceAt ? new Date(balanceAt) : null;

export const mainBalanceFields = (account: ProviderAccount) => {
  const { balanceAt, balanceMinor, currency } = account;

  if (currency !== undefined && balanceMinor !== undefined) {
    return { balanceAt: toBalanceAt(balanceAt), balanceMinor, currency };
  }

  const balances = reportedBalances(account);

  if (!balances) {
    return currency === undefined ? {} : { currency };
  }

  const mainCurrency = currency ?? balances[0]?.currency ?? null;
  const main = balances.find((balance) => balance.currency === mainCurrency);

  return {
    balanceAt: toBalanceAt(main?.balanceAt),
    balanceMinor: main?.balanceMinor ?? null,
    currency: mainCurrency,
  };
};

const replaceBalances = async (
  accountId: string,
  balances: readonly ProviderBalance[]
): Promise<void> => {
  await prisma.$transaction([
    prisma.accountBalance.deleteMany({
      where: {
        accountId,
        currency: { notIn: balances.map((balance) => balance.currency) },
      },
    }),
    ...balances.map((balance) => {
      const fields = {
        balanceAt: toBalanceAt(balance.balanceAt),
        balanceMinor: balance.balanceMinor,
      };

      return prisma.accountBalance.upsert({
        create: { ...fields, accountId, currency: balance.currency },
        update: fields,
        where: {
          accountId_currency: { accountId, currency: balance.currency },
        },
      });
    }),
  ]);
};

const refreshProviderAccounts = async (
  provider: BankingProvider,
  connection: ConnectionWithAccounts,
  user: ProviderUserSession | null
): Promise<SyncAccount[]> => {
  const { fetchAccounts } = provider;

  if (!fetchAccounts) {
    return connection.accounts;
  }

  const accounts = await fetchAccounts({
    providerSessionId: connection.providerSessionId,
    user,
  });

  const rows: SyncAccount[] = [];

  for (const account of accounts) {
    const fields = {
      ...mainBalanceFields(account),
      iban: account.iban ?? null,
      name: account.name ?? null,
      type: account.type,
    };

    // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
    const row = await prisma.bankAccount.upsert({
      create: {
        ...fields,
        connectionId: connection.id,
        providerAccountId: account.providerAccountId,
      },
      select: { currency: true, id: true, providerAccountId: true, type: true },
      update: fields,
      where: {
        connectionId_providerAccountId: {
          connectionId: connection.id,
          providerAccountId: account.providerAccountId,
        },
      },
    });

    const balances = reportedBalances(account);

    if (balances) {
      // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
      await replaceBalances(row.id, balances);
    }

    rows.push(row);
  }

  return rows;
};

const replaceHoldings = async (
  accountId: string,
  holdings: ProviderHolding[]
): Promise<void> => {
  await prisma.$transaction(async (db) => {
    await db.holding.deleteMany({
      where: {
        accountId,
        providerHoldingId: {
          notIn: holdings.map((holding) => holding.providerHoldingId),
        },
      },
    });

    for (const holding of holdings) {
      const fields = {
        code: holding.code ?? null,
        codeType: holding.codeType ?? null,
        currency: holding.currency,
        label: holding.label,
        quantity: holding.quantity,
        unitCost: holding.unitCost ?? null,
        unitValue: holding.unitValue ?? null,
        unrealisedGainMinor: holding.unrealisedGainMinor ?? null,
        valuationMinor: holding.valuationMinor,
        valuedAt: holding.valuedAt ? new Date(holding.valuedAt) : null,
      };

      // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
      await db.holding.upsert({
        create: {
          ...fields,
          accountId,
          providerHoldingId: holding.providerHoldingId,
        },
        update: fields,
        where: {
          accountId_providerHoldingId: {
            accountId,
            providerHoldingId: holding.providerHoldingId,
          },
        },
      });
    }
  });
};

export const syncWindow = (
  lastSyncedAt: Date | null,
  now: Date,
  reReadFullWindow: boolean,
  oldestPending: Date | null
): SyncWindow => {
  const fullWindowStart = new Date(
    now.getTime() - PROVIDER_SERVED_HISTORY_DAYS * MS_PER_DAY
  );

  const lastSync = reReadFullWindow
    ? fullWindowStart
    : (lastSyncedAt ?? fullWindowStart);

  const earliest =
    oldestPending && oldestPending < lastSync ? oldestPending : lastSync;

  const start = earliest < fullWindowStart ? fullWindowStart : earliest;

  return {
    dateFrom: start.toISOString().split("T")[0] ?? "",
    dateTo: now.toISOString().split("T")[0] ?? "",
  };
};

export const earliestImportedDay = (
  connections: { lastSyncedAt: Date | null }[],
  force: boolean,
  oldestPending: Date | null,
  now: Date = new Date()
): Date | null => {
  const starts = connections.map((connection) =>
    new Date(
      syncWindow(connection.lastSyncedAt, now, force, oldestPending).dateFrom
    ).getTime()
  );

  return starts.length === 0 ? null : new Date(Math.min(...starts));
};

const oldestPendingDate = async (
  connectionIds: readonly string[]
): Promise<Date | null> => {
  const pending = await prisma.transaction.aggregate({
    _min: { date: true },
    where: {
      account: { connectionId: { in: [...connectionIds] } },
      status: PENDING,
    },
  });

  return pending._min.date;
};

export const staleTransactionsWhere = (
  accountId: string,
  dateFrom: string,
  fetched: readonly ProviderTransaction[]
): Prisma.TransactionWhereInput => ({
  OR: [
    { status: REJECTED },
    {
      date: { gte: new Date(dateFrom) },
      providerTransactionId: {
        notIn: fetched.map((tx) => tx.providerTransactionId),
      },
      status: PENDING,
    },
  ],
  accountId,
});

const importAccount = async (context: AccountSyncContext): Promise<void> => {
  const {
    account,
    connection,
    deleteTransactions,
    provider,
    reporter,
    user,
    window,
  } = context;

  const transactions = await provider.fetchTransactions({
    accountCurrency: account.currency,
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
    providerAccountId: account.providerAccountId,
    providerSessionId: connection.providerSessionId,
    user,
  });

  const kept = transactions.filter((tx) => tx.status !== REJECTED);

  await upsertTransactionsInBatches(account.id, kept, connection, reporter);
  await deleteTransactions(
    staleTransactionsWhere(account.id, window.dateFrom, kept)
  );

  const { fetchHoldings } = provider;

  if (fetchHoldings && accountTypeRule(account.type).holdsPositions) {
    const holdings = await fetchHoldings({
      providerAccountId: account.providerAccountId,
      providerSessionId: connection.providerSessionId,
      user,
    });

    await replaceHoldings(account.id, holdings);
  }
};

export const importAccountsInSeries = (
  context: ConnectionSyncContext,
  accounts: readonly SyncAccount[]
): Effect.Effect<BankSyncFailed[]> =>
  Effect.all(
    accounts.map((account) =>
      Effect.tryPromise({
        catch: accountFailure(account, context.provider),
        try: () => importAccount({ ...context, account }),
      }).pipe(
        Effect.as([]),
        Effect.catchTag("BankSyncFailed", (failure) =>
          Effect.succeed([failure])
        ),
        Effect.tap(() =>
          Effect.promise(() => context.reporter.accountFinished())
        )
      )
    )
  ).pipe(Effect.map((failures) => failures.flat()));

const connectionSteps = Effect.fnUntraced(function* connectionSteps(
  connection: ConnectionWithAccounts,
  user: ProviderUserSession | null,
  reporter: SyncReporter,
  reReadFullWindow: boolean
) {
  const failed = connectionFailure(connection, null);
  const now = new Date();
  const oldestPending = yield* Effect.tryPromise({
    catch: failed,
    try: () => oldestPendingDate([connection.id]),
  });

  const window = syncWindow(
    connection.lastSyncedAt,
    now,
    reReadFullWindow,
    oldestPending
  );

  const provider = yield* Effect.try({
    catch: failed,
    try: () => getProvider(connection.provider),
  });

  const accounts = yield* Effect.tryPromise({
    catch: connectionFailure(connection, provider),
    try: () => refreshProviderAccounts(provider, connection, user),
  });

  yield* Effect.promise(() => reporter.accountsDiscovered(accounts.length));

  const accountFailures = yield* importAccountsInSeries(
    {
      connection,
      deleteTransactions: (where) => prisma.transaction.deleteMany({ where }),
      provider,
      reporter,
      user,
      window,
    },
    accounts
  );

  if (accountFailures.length > 0) {
    return accountFailures;
  }

  yield* Effect.tryPromise({
    catch: failed,
    try: () =>
      prisma.bankConnection.update({
        data: { lastSyncedAt: now },
        where: { id: connection.id },
      }),
  });

  return [];
});

export const concludeSync = Effect.fnUntraced(function* concludeSync(
  failures: readonly BankSyncFailed[],
  expireConnection: () => Promise<void>
) {
  if (failures.some((failure) => failure.needsReconnect)) {
    yield* Effect.promise(expireConnection);
  }

  return failures.map((failure) => failure.message);
});

const syncConnection = (
  connection: ConnectionWithAccounts,
  user: ProviderUserSession | null,
  reporter: SyncReporter,
  force = false
): Promise<string[]> =>
  Effect.runPromise(
    connectionSteps(connection, user, reporter, force).pipe(
      Effect.catchTag("BankSyncFailed", (failure) => Effect.succeed([failure])),
      Effect.flatMap((failures) =>
        concludeSync(failures, async () => {
          await prisma.bankConnection.update({
            data: { status: "EXPIRED" },
            where: { id: connection.id },
          });
        })
      )
    )
  );

const syncEveryConnection = (
  connections: Parameters<typeof syncConnection>[0][],
  userId: string,
  reporter: SyncReporter,
  force: boolean
): Effect.Effect<BudgetPipelineReason[]> =>
  Effect.forEach(
    connections,
    (connection) => {
      const failed = (cause: unknown) =>
        new BudgetPipelineFailed({
          cause,
          reason: {
            connectionId: connection.id,
            institutionName: connection.institutionName,
            kind: "connection-sync",
          },
        });

      return Effect.tryPromise({
        catch: failed,
        try: async () => {
          const providerUser = await findProviderUser(
            userId,
            getProvider(connection.provider)
          );

          return await syncConnection(
            connection,
            providerUser,
            reporter,
            force
          );
        },
      }).pipe(
        Effect.flatMap((failureLines) =>
          failureLines.length === 0
            ? Effect.succeed(null)
            : Effect.fail(failed(failureLines))
        ),
        Effect.catchTag("BudgetPipelineFailed", reportPipelineFailure)
      );
    },
    { concurrency: 1 }
  ).pipe(
    Effect.map((failures) => failures.filter((failure) => failure !== null))
  );

const runSyncAccounts = Effect.fnUntraced(function* runSyncAccounts(
  userId: string,
  connectionId: string | undefined,
  force: boolean,
  reporter: SyncReporter
) {
  const where: Prisma.BankConnectionWhereInput = { status: "ACTIVE", userId };

  if (connectionId) {
    where.id = connectionId;
  }

  const connections = yield* Effect.promise(() =>
    prisma.bankConnection.findMany({
      include: {
        accounts: {
          select: {
            currency: true,
            id: true,
            providerAccountId: true,
            type: true,
          },
          where: { inConsent: true },
        },
      },
      where,
    })
  );

  const oldestPending = yield* Effect.promise(() =>
    oldestPendingDate(connections.map((connection) => connection.id))
  );

  const connectionFailures = yield* syncEveryConnection(
    connections,
    userId,
    reporter,
    force
  );

  yield* Effect.promise(() => refreshExchangeRatesNow());

  yield* Effect.promise(() =>
    matchInternalTransfers(
      userId,
      earliestImportedDay(connections, force, oldestPending)
    )
  );

  const { categorised, failure } = yield* categoriseAfterSync(
    userId,
    connectionId,
    reporter,
    force
  );

  return {
    categorised,
    failures: failure ? [...connectionFailures, failure] : connectionFailures,
  };
});

export const startAccountSync = async (
  userId: string,
  { connectionId, force }: { connectionId?: string; force: boolean }
): Promise<Date | null> => {
  const claimedAt = await claimSyncRun(userId, "IMPORTING");

  if (claimedAt === null) {
    return null;
  }

  const reporter = createSyncReporter(userId, "IMPORTING", claimedAt);

  Effect.runFork(
    runSyncAccounts(userId, connectionId, force, reporter).pipe(
      Effect.tapCause(Effect.logError),
      Effect.matchCauseEffect({
        onFailure: () => Effect.promise(() => reporter.finished()),
        onSuccess: (outcome) =>
          Effect.promise(() => reporter.finishedWith(outcome)),
      })
    )
  );

  return claimedAt;
};
