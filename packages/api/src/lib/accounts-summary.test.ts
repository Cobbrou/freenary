import { describe, expect, it } from "bun:test";

import { accountsSummary } from "./accounts-summary";

describe("accountsSummary", () => {
  it("counts only checking accounts as available", () => {
    expect(
      accountsSummary([
        { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
        { balanceMinor: 500_000, currency: "EUR", type: "SAVINGS" },
        { balanceMinor: -900_000, currency: "EUR", type: "LOAN" },
      ])
    ).toEqual({ availableBalanceMinor: 120_000, currency: "EUR" });
  });

  it("leaves out an account in another currency", () => {
    expect(
      accountsSummary([
        { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
        { balanceMinor: 30_000, currency: "EUR", type: "CHECKING" },
        { balanceMinor: 80_000, currency: "USD", type: "CHECKING" },
      ])
    ).toEqual({ availableBalanceMinor: 150_000, currency: "EUR" });
  });

  it("is null when no checking account reports a balance", () => {
    expect(
      accountsSummary([
        { balanceMinor: null, currency: "EUR", type: "CHECKING" },
        { balanceMinor: 500_000, currency: "EUR", type: "SAVINGS" },
      ])
    ).toEqual({ availableBalanceMinor: null, currency: "EUR" });
  });
});
