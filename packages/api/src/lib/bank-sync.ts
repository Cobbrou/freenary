import prisma, { Prisma } from "@freenary/db";
import { Data, Effect, Match } from "effect";

import { deriveMerchantKey } from "../categorisation/merchant-key";
import { getProvider } from "../providers/registry";
import type {
  BankingProvider,
  ProviderHolding,
  ProviderTransaction,
  ProviderUserSession,
} from "../providers/types";
import { isInvestmentAccountType } from "../providers/types";
import type { SyncReporter } from "./sync-progress";

interface SyncAccount {
  id: string;
  providerAccountId: string;
  type: string;
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
  readonly scope: SyncScope;
}> {}

const PROVIDER_SERVED_HISTORY_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const failureLine = (failure: BankSyncFailed): string =>
  Match.value(failure.scope).pipe(
    Match.discriminatorsExhaustive("kind")({
      account: (scope) =>
        `Account ${scope.providerAccountId}: ${failure.detail}`,
      connection: (scope) =>
        `Connection ${scope.institutionName}: ${failure.detail}`,
    })
  );

const accountFailure =
  (account: SyncAccount) =>
  (cause: unknown): BankSyncFailed =>
    new BankSyncFailed({
      detail: cause instanceof Error ? cause.message : "Unknown account error",
      scope: { kind: "account", providerAccountId: account.providerAccountId },
    });

const connectionFailure =
  (connection: ConnectionWithAccounts) =>
  (cause: unknown): BankSyncFailed =>
    new BankSyncFailed({
      detail:
        cause instanceof Error ? cause.message : "Unknown connection error",
      scope: {
        institutionName: connection.institutionName,
        kind: "connection",
      },
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
  amount: "integer",
  balanceAfterTransaction: "integer",
  creditorIdentifications: "jsonb",
  date: "timestamp(3)",
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
      balanceAt: account.balanceAt ? new Date(account.balanceAt) : null,
      balanceMinor: account.balanceMinor ?? null,
      currency: account.currency ?? null,
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
      select: { id: true, providerAccountId: true, type: true },
      update: fields,
      where: {
        connectionId_providerAccountId: {
          connectionId: connection.id,
          providerAccountId: account.providerAccountId,
        },
      },
    });

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

const syncWindow = (
  connection: ConnectionWithAccounts,
  now: Date,
  reReadFullWindow: boolean
): SyncWindow => {
  const fullWindowStart = new Date(
    now.getTime() - PROVIDER_SERVED_HISTORY_DAYS * MS_PER_DAY
  );

  const start = reReadFullWindow
    ? fullWindowStart
    : (connection.lastSyncedAt ?? fullWindowStart);

  return {
    dateFrom: start.toISOString().split("T")[0] ?? "",
    dateTo: now.toISOString().split("T")[0] ?? "",
  };
};

const importAccount = async (context: AccountSyncContext): Promise<void> => {
  const { account, connection, provider, reporter, user, window } = context;

  const transactions = await provider.fetchTransactions({
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
    providerAccountId: account.providerAccountId,
    providerSessionId: connection.providerSessionId,
    user,
  });

  await upsertTransactionsInBatches(
    account.id,
    transactions,
    connection,
    reporter
  );

  const { fetchHoldings } = provider;

  if (fetchHoldings && isInvestmentAccountType(account.type)) {
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
): Effect.Effect<string[]> =>
  Effect.all(
    accounts.map((account) =>
      Effect.tryPromise({
        catch: accountFailure(account),
        try: () => importAccount({ ...context, account }),
      }).pipe(
        Effect.as([]),
        Effect.catchTag("BankSyncFailed", (failure) =>
          Effect.succeed([failureLine(failure)])
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
  const failed = connectionFailure(connection);
  const now = new Date();
  const window = syncWindow(connection, now, reReadFullWindow);

  const provider = yield* Effect.try({
    catch: failed,
    try: () => getProvider(connection.provider),
  });

  const accounts = yield* Effect.tryPromise({
    catch: failed,
    try: () => refreshProviderAccounts(provider, connection, user),
  });

  yield* Effect.promise(() => reporter.accountsDiscovered(accounts.length));

  const accountFailures = yield* importAccountsInSeries(
    { connection, provider, reporter, user, window },
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

export const syncConnection = (
  connection: ConnectionWithAccounts,
  user: ProviderUserSession | null,
  reporter: SyncReporter,
  force = false
): Promise<string[]> =>
  Effect.runPromise(
    connectionSteps(connection, user, reporter, force).pipe(
      Effect.catchTag("BankSyncFailed", (failure) =>
        Effect.succeed([failureLine(failure)])
      )
    )
  );
