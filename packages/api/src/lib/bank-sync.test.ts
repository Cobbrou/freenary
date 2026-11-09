import { describe, expect, it, mock } from "bun:test";

import { Effect } from "effect";

import { mockProvider } from "../providers/mock";
import type {
  FetchTransactionsRequest,
  ProviderTransaction,
} from "../providers/types";
import {
  earliestImportedDay,
  importAccountsInSeries,
  staleTransactionsWhere,
  syncWindow,
} from "./bank-sync";
import type { ConnectionSyncContext } from "./bank-sync";
import type { SyncReporter } from "./sync-progress";

const checking = {
  id: "account-checking",
  providerAccountId: "checking",
  type: "CACC",
};

const savings = {
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

    expect(accountFailures).toEqual(["Account savings: timeout"]);
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
