import { describe, expect, it, mock } from "bun:test";

import { Effect } from "effect";

import { enableBankingProvider } from "../providers/enable-banking";
import { EnableBankingRequestFailed } from "../providers/enable-banking/client";
import { mockProvider } from "../providers/mock";
import { PowensConnectionUnusable, powensProvider } from "../providers/powens";
import { PowensRequestFailed } from "../providers/powens/client";
import type {
  BankingProvider,
  FetchTransactionsRequest,
  ProviderTransaction,
} from "../providers/types";
import {
  concludeSync,
  connectionFailure,
  earliestImportedDay,
  importAccountsInSeries,
  mainBalanceFields,
  reportedBalances,
  staleTransactionsWhere,
  syncWindow,
} from "./bank-sync";
import type { ConnectionSyncContext } from "./bank-sync";
import type { SyncReporter } from "./sync-progress";

const checking = {
  currency: "EUR",
  id: "account-checking",
  providerAccountId: "checking",
  type: "CACC",
};

const savings = {
  currency: "EUR",
  id: "account-savings",
  providerAccountId: "savings",
  type: "SVGS",
};

const reporter: SyncReporter = {
  accountFinished: () => Promise.resolve(),
  accountsDiscovered: () => Promise.resolve(),
  categorised: () => Promise.resolve(),
  categorisingStarted: () => Promise.resolve(),
  finished: () => Promise.resolve(),
  finishedWith: () => Promise.resolve(),
  heartbeat: () => Promise.resolve(),
  transactionsImported: () => Promise.resolve(),
};

const contextFailing = (
  failingAccountIds: readonly string[],
  deleteTransactions: ConnectionSyncContext["deleteTransactions"] = () =>
    Promise.resolve({ count: 0 })
): ConnectionSyncContext => ({
  connection: {
    accounts: [checking, savings],
    id: "connection-1",
    institutionBic: null,
    institutionCountry: "FR",
    institutionGroup: null,
    institutionName: "Mock Bank",
    lastSyncedAt: new Date("2026-10-01T08:00:00.000Z"),
    provider: mockProvider.id,
    providerSessionId: "session-1",
    status: "ACTIVE",
  },
  deleteTransactions,
  provider: {
    ...mockProvider,
    fetchTransactions: ({ providerAccountId }: FetchTransactionsRequest) =>
      failingAccountIds.includes(providerAccountId)
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve([]),
  },
  reporter,
  user: null,
  window: { dateFrom: "2026-10-01", dateTo: "2026-10-26" },
});

describe("importAccountsInSeries", () => {
  it("reports a failed account, so lastSyncedAt stays put", async () => {
    const accountFailures = await Effect.runPromise(
      importAccountsInSeries(contextFailing(["savings"]), [checking, savings])
    );

    expect(accountFailures.map((failure) => failure.message)).toEqual([
      "Account savings: timeout",
    ]);
  });

  it("drops stale rows only for the account that imported", async () => {
    const deleteTransactions = mock<
      ConnectionSyncContext["deleteTransactions"]
    >(() => Promise.resolve({ count: 0 }));

    await Effect.runPromise(
      importAccountsInSeries(contextFailing(["savings"], deleteTransactions), [
        checking,
        savings,
      ])
    );

    expect(deleteTransactions.mock.calls).toEqual([
      [staleTransactionsWhere(checking.id, "2026-10-01", [])],
    ]);
  });

  it("reports no failure when every account imports", async () => {
    const accountFailures = await Effect.runPromise(
      importAccountsInSeries(contextFailing([]), [checking, savings])
    );

    expect(accountFailures).toEqual([]);
  });
});

const enableBankingRejected = (status: number, body: string) =>
  new EnableBankingRequestFailed({
    operation: "transactions",
    reason: { body, kind: "rejected", status },
  });

const endedSession = (errorCode: string) =>
  enableBankingRejected(
    401,
    JSON.stringify({ code: 401, error: errorCode, message: "Session is over" })
  );

const concludeAfter = async (provider: BankingProvider, cause: Error) => {
  const expireConnection = mock(() => Promise.resolve());
  const { connection } = contextFailing([]);
  const reported = await Effect.runPromise(
    concludeSync(
      [connectionFailure(connection, provider)(cause)],
      expireConnection
    )
  );

  return { expired: expireConnection.mock.calls.length === 1, reported };
};

describe("concludeSync", () => {
  it.each(["SCARequired", "passwordExpired", "wrongpass"])(
    "expires a Powens connection in the state %s",
    async (state) => {
      expect(
        await concludeAfter(
          powensProvider,
          new PowensConnectionUnusable({
            reason: { kind: "needsUserAction", state },
          })
        )
      ).toEqual({
        expired: true,
        reported: [
          `Connection Mock Bank: Powens connection needs the user's attention (${state})`,
        ],
      });
    }
  );

  it.each(["CLOSED_SESSION", "EXPIRED_SESSION", "REVOKED_SESSION"])(
    "expires an Enable Banking connection on %s",
    async (code) => {
      const { expired } = await concludeAfter(
        enableBankingProvider,
        endedSession(code)
      );

      expect(expired).toBe(true);
    }
  );

  it.each([
    [
      "a Powens timeout",
      powensProvider,
      new PowensRequestFailed({
        operation: "connection",
        reason: { detail: "TimeoutError", kind: "unreachable" },
      }),
    ],
    [
      "a Powens 5xx",
      powensProvider,
      new PowensRequestFailed({
        operation: "connection",
        reason: { body: "", kind: "rejected", status: 503 },
      }),
    ],
    [
      "an Enable Banking timeout",
      enableBankingProvider,
      new EnableBankingRequestFailed({
        operation: "transactions",
        reason: { detail: "TimeoutError", kind: "unreachable" },
      }),
    ],
    [
      "an Enable Banking 5xx with no JSON",
      enableBankingProvider,
      enableBankingRejected(502, "<html>Bad Gateway</html>"),
    ],
    [
      "an Enable Banking 401 about the application",
      enableBankingProvider,
      endedSession("UNAUTHORIZED_ACCESS"),
    ],
  ])("keeps the connection active after %s", async (_, provider, cause) => {
    const { expired, reported } = await concludeAfter(provider, cause);

    expect(expired).toBe(false);
    expect(reported).toHaveLength(1);
  });

  it("recognises a session that ended when an account is read", async () => {
    const context = contextFailing([]);
    const failures = await Effect.runPromise(
      importAccountsInSeries(
        {
          ...context,
          provider: {
            ...enableBankingProvider,
            fetchTransactions: () =>
              Promise.reject(endedSession("EXPIRED_SESSION")),
          },
        },
        [checking]
      )
    );

    expect(failures.map((failure) => failure.needsReconnect)).toEqual([true]);
  });
});

const now = new Date("2026-10-29T12:00:00Z");

const transaction = (
  providerTransactionId: string,
  status: string
): ProviderTransaction => ({
  amountMinor: -1250,
  bookingDate: "2026-10-21",
  currency: "EUR",
  providerTransactionId,
  remittanceLines: ["CARREFOUR"],
  status,
});

describe("syncWindow", () => {
  it("starts at the last sync", () => {
    expect(
      syncWindow(new Date("2026-10-25T08:00:00Z"), now, false, null).dateFrom
    ).toBe("2026-10-25");
  });

  it("reaches back to the oldest pending row", () => {
    expect(
      syncWindow(
        new Date("2026-10-25T08:00:00Z"),
        now,
        false,
        new Date("2026-10-20T00:00:00Z")
      ).dateFrom
    ).toBe("2026-10-20");
  });

  it("never reaches past the 90 days the provider serves", () => {
    expect(
      syncWindow(null, now, false, new Date("2026-01-01T00:00:00Z")).dateFrom
    ).toBe("2026-07-31");
  });
});

describe("staleTransactionsWhere", () => {
  it("drops every rejected row, and pending rows the bank stopped returning", () => {
    expect(
      staleTransactionsWhere("account", "2026-10-20", [
        transaction("booked", "BOOK"),
        transaction("still-pending", "PDNG"),
      ])
    ).toEqual({
      OR: [
        { status: "RJCT" },
        {
          date: { gte: new Date("2026-10-20") },
          providerTransactionId: { notIn: ["booked", "still-pending"] },
          status: "PDNG",
        },
      ],
      accountId: "account",
    });
  });
});

describe("earliestImportedDay", () => {
  it("reaches back to the oldest pending row, as the sync does", () => {
    expect(
      earliestImportedDay(
        [{ lastSyncedAt: new Date("2026-10-25T08:00:00Z") }],
        false,
        new Date("2026-10-20T00:00:00Z"),
        now
      )
    ).toEqual(new Date("2026-10-20"));
  });

  it("starts at the earliest last sync with no pending row", () => {
    expect(
      earliestImportedDay(
        [
          { lastSyncedAt: new Date("2026-10-25T08:00:00Z") },
          { lastSyncedAt: new Date("2026-10-27T08:00:00Z") },
        ],
        false,
        null,
        now
      )
    ).toEqual(new Date("2026-10-25"));
  });
});

describe("account currency", () => {
  it("asks the provider for transactions in the account's currency", async () => {
    const requested: (string | null)[] = [];
    const context = contextFailing([]);

    await Effect.runPromise(
      importAccountsInSeries(
        {
          ...context,
          provider: {
            ...context.provider,
            fetchTransactions: (request: FetchTransactionsRequest) => {
              requested.push(request.accountCurrency);

              return Promise.resolve([]);
            },
          },
        },
        [checking, { ...savings, currency: null }]
      )
    );

    expect(requested).toEqual(["EUR", null]);
  });
});

const providerAccount = {
  providerAccountId: "multi",
  type: "CHECKING" as const,
};

describe("reportedBalances", () => {
  it("keeps one balance per currency the provider lists", () => {
    expect(
      reportedBalances({
        ...providerAccount,
        balances: [
          { balanceMinor: 1000, currency: "EUR" },
          { balanceMinor: 2500, currency: "USD" },
        ],
      })
    ).toEqual([
      { balanceMinor: 1000, currency: "EUR" },
      { balanceMinor: 2500, currency: "USD" },
    ]);
  });

  it("derives a single balance from the main currency and amount", () => {
    expect(
      reportedBalances({
        ...providerAccount,
        balanceAt: "2026-10-28T10:00:00Z",
        balanceMinor: 4200,
        currency: "EUR",
      })
    ).toEqual([
      {
        balanceAt: "2026-10-28T10:00:00Z",
        balanceMinor: 4200,
        currency: "EUR",
      },
    ]);
  });

  it("reports nothing to replace when no balance is known", () => {
    expect(reportedBalances({ ...providerAccount, currency: "EUR" })).toBe(
      null
    );
  });
});

describe("mainBalanceFields", () => {
  it("keeps the main currency and amount the provider gives", () => {
    expect(
      mainBalanceFields({
        ...providerAccount,
        balanceMinor: 4200,
        balances: [{ balanceMinor: 900, currency: "USD" }],
        currency: "EUR",
      })
    ).toEqual({ balanceAt: null, balanceMinor: 4200, currency: "EUR" });
  });

  it("takes the balance in the account currency from the list", () => {
    expect(
      mainBalanceFields({
        ...providerAccount,
        balances: [
          { balanceMinor: 900, currency: "USD" },
          {
            balanceAt: "2026-10-28T10:00:00Z",
            balanceMinor: 1000,
            currency: "EUR",
          },
        ],
        currency: "EUR",
      })
    ).toEqual({
      balanceAt: new Date("2026-10-28T10:00:00Z"),
      balanceMinor: 1000,
      currency: "EUR",
    });
  });

  it("falls back to the first balance without an account currency", () => {
    expect(
      mainBalanceFields({
        ...providerAccount,
        balances: [
          { balanceMinor: 900, currency: "USD" },
          { balanceMinor: 1000, currency: "EUR" },
        ],
      })
    ).toEqual({ balanceAt: null, balanceMinor: 900, currency: "USD" });
  });

  it("leaves the stored balance alone when none is reported", () => {
    expect(mainBalanceFields({ ...providerAccount, currency: "EUR" })).toEqual({
      currency: "EUR",
    });

    expect(mainBalanceFields(providerAccount)).toEqual({});
  });
});
