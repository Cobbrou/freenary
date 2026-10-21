import { describe, expect, it } from "bun:test";

import { syncProgressShape } from "./sync-progress";
import type { SyncProgress } from "./sync-progress";

const progress = (overrides: Partial<SyncProgress>): SyncProgress => ({
  accountsDone: 0,
  accountsTotal: 0,
  categorised: 0,
  categorisedTotal: 0,
  phase: "importing",
  transactionsImported: 0,
  ...overrides,
});

describe("syncProgressShape", () => {
  it("has no percentage while importing, because the total is unknown", () => {
    expect(
      syncProgressShape(
        progress({ accountsTotal: 2, transactionsImported: 80 })
      ).percent
    ).toBeNull();
  });

  it("counts the transactions that landed once any did", () => {
    expect(
      syncProgressShape(
        progress({
          accountsDone: 1,
          accountsTotal: 2,
          transactionsImported: 80,
        })
      ).detail
    ).toEqual({ count: 80, kind: "transactions" });
  });

  it("names the account being read before its first transaction", () => {
    expect(
      syncProgressShape(progress({ accountsDone: 1, accountsTotal: 3 })).detail
    ).toEqual({ done: 2, kind: "accounts", total: 3 });
  });

  it("never counts an account past the total", () => {
    expect(
      syncProgressShape(progress({ accountsDone: 3, accountsTotal: 3 })).detail
    ).toEqual({ done: 3, kind: "accounts", total: 3 });
  });

  it("says it is still reaching the banks before any account answered", () => {
    expect(syncProgressShape(progress({})).detail).toEqual({
      kind: "starting",
    });
  });

  it("turns categorisation into a percentage of the work it knows", () => {
    expect(
      syncProgressShape(
        progress({
          categorised: 21,
          categorisedTotal: 42,
          phase: "categorising",
        })
      )
    ).toEqual({
      detail: { done: 21, kind: "categorised", total: 42 },
      percent: 50,
      phase: "categorising",
    });
  });

  it("has no percentage when categorisation has nothing to do", () => {
    expect(
      syncProgressShape(progress({ phase: "categorising" })).percent
    ).toBeNull();
  });
});
