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

interface ConnectionSyncContext {
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

const recordFailure =
  (errors: string[]) =>
  (failure: BankSyncFailed): Effect.Effect<void> =>
    Effect.sync(() => {
      errors.push(failureLine(failure));
    });

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

const upsertTransaction = async (
  accountId: string,
  tx: ProviderTransaction,
  connection: ConnectionWithAccounts
) => {
  const shared = mapProviderFields(tx);
  const keyResult = deriveKey(tx, connection);

  await prisma.transaction.upsert({
    create: {
      ...shared,
      accountId,
      category: null,
      categoryOverride: false,
      channel: keyResult.channel,
      intermediaryName: keyResult.intermediaryName,
      merchantKey: keyResult.merchantKey || null,
      normalisedDescriptor: keyResult.normalisedDescriptor || null,
      providerTransactionId: tx.providerTransactionId,
      transactionPath: keyResult.path,
    },
    update: {
      ...shared,
      channel: keyResult.channel,
      intermediaryName: keyResult.intermediaryName,
      merchantKey: keyResult.merchantKey || null,
      normalisedDescriptor: keyResult.normalisedDescriptor || null,
      transactionPath: keyResult.path,
    },
    where: {
      accountId_providerTransactionId: {
        accountId,
        providerTransactionId: tx.providerTransactionId,
      },
    },
  });
};

const upsertTransactionsInSeries = async (
  accountId: string,
  transactions: readonly ProviderTransaction[],
  connection: ConnectionWithAccounts,
  reporter: SyncReporter
): Promise<void> => {
  for (const tx of transactions) {
    // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
    await upsertTransaction(accountId, tx, connection);
    // eslint-disable-next-line no-await-in-loop -- the reporter writes at most once a second; the rest resolve immediately
    await reporter.transactionsImported(1);
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

  await upsertTransactionsInSeries(
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

const importAccountsInSeries = (
  context: ConnectionSyncContext,
  accounts: readonly SyncAccount[],
  errors: string[]
): Effect.Effect<void> =>
  Effect.forEach(
    accounts,
    (account) =>
      Effect.tryPromise({
        catch: accountFailure(account),
        try: () => importAccount({ ...context, account }),
      }).pipe(
        Effect.catchTag("BankSyncFailed", recordFailure(errors)),
        Effect.flatMap(() =>
          Effect.promise(() => context.reporter.accountFinished())
        )
      ),
    { discard: true }
  );

const connectionSteps = Effect.fnUntraced(function* connectionSteps(
  connection: ConnectionWithAccounts,
  errors: string[],
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

  yield* importAccountsInSeries(
    { connection, provider, reporter, user, window },
    accounts,
    errors
  );

  yield* Effect.tryPromise({
    catch: failed,
    try: () =>
      prisma.bankConnection.update({
        data: { lastSyncedAt: now },
        where: { id: connection.id },
      }),
  });
});

export const syncConnection = async (
  connection: ConnectionWithAccounts,
  errors: string[],
  user: ProviderUserSession | null,
  reporter: SyncReporter,
  force = false
): Promise<void> => {
  await Effect.runPromise(
    connectionSteps(connection, errors, user, reporter, force).pipe(
      Effect.catchTag("BankSyncFailed", recordFailure(errors))
    )
  );
};
