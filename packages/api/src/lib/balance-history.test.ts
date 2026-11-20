import { describe, expect, it } from "bun:test";

import { balanceHistory, monthEndsBefore } from "./balance-history";

const today = new Date("2026-11-18T10:00:00.000Z");

describe("monthEndsBefore", () => {
  it("lists the last day of each month before this one, oldest first", () => {
    expect(monthEndsBefore(today, 3).map((date) => date.toISOString())).toEqual(
      [
        "2026-08-31T23:59:59.999Z",
        "2026-09-30T23:59:59.999Z",
        "2026-10-31T23:59:59.999Z",
      ]
    );
  });
});

describe("balanceHistory", () => {
  it("rebuilds past balances by taking back what moved since", () => {
    expect(
      balanceHistory(
        [{ balanceMinor: 100_000, currency: "EUR", id: "checking" }],
        [
          {
            accountId: "checking",
            amount: -20_000,
            date: new Date("2026-10-15T00:00:00.000Z"),
          },
          {
            accountId: "checking",
            amount: 50_000,
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
        ],
        "EUR",
        today,
        2
      )
    ).toEqual([
      { balanceMinor: 70_000, date: "2026-09-30" },
      { balanceMinor: 50_000, date: "2026-10-31" },
      { balanceMinor: 100_000, date: "2026-11-18" },
    ]);
  });

  it("leaves out accounts with no balance or in another currency", () => {
    expect(
      balanceHistory(
        [
          { balanceMinor: 10_000, currency: "EUR", id: "eur" },
          { balanceMinor: 99_999, currency: "USD", id: "usd" },
          { balanceMinor: null, currency: "EUR", id: "unknown" },
        ],
        [
          {
            accountId: "usd",
            amount: 5000,
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
        ],
        "EUR",
        today,
        1
      )
    ).toEqual([
      { balanceMinor: 10_000, date: "2026-10-31" },
      { balanceMinor: 10_000, date: "2026-11-18" },
    ]);
  });

  it("has no history when no account carries a balance", () => {
    expect(balanceHistory([], [], "EUR", today, 6)).toBeNull();
  });
});
