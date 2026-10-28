import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { mockProvider } from "../providers/mock";
import type { FetchTransactionsRequest } from "../providers/types";
import { importAccountsInSeries, merchantKeyDiffers } from "./bank-sync";
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
  heartbeat: () => Promise.resolve(),
  transactionsImported: () => Promise.resolve(),
};

const contextFailing = (
  failingAccountIds: readonly string[]
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

  it("reports no failure when every account imports", async () => {
    const accountFailures = await Effect.runPromise(
      importAccountsInSeries(contextFailing([]), [checking, savings])
    );

    expect(accountFailures).toEqual([]);
  });
});

describe("merchantKeyDiffers", () => {
  it("matches a stored key, or none, that differs from a new key", () => {
    expect(merchantKeyDiffers("FR7612345")).toEqual({
      OR: [{ merchantKey: { not: "FR7612345" } }, { merchantKey: null }],
    });
  });

  it("matches any stored key when the new key is empty", () => {
    expect(merchantKeyDiffers(null)).toEqual({ merchantKey: { not: null } });
  });
});
