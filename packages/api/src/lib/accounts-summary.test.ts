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

  it("leaves out every savings account, regulated or not, and every investment", () => {
    expect(
      accountsSummary([
        { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
        { balanceMinor: 2_295_000, currency: "EUR", type: "LIVRET_A" },
        { balanceMinor: 1_200_000, currency: "EUR", type: "LDDS" },
        { balanceMinor: 600_000, currency: "EUR", type: "PEL" },
        { balanceMinor: 900_000, currency: "EUR", type: "PEA" },
      ])
    ).toEqual({ availableBalanceMinor: 120_000, currency: "EUR" });
  });

  it("takes off the deferred card spending the current account will pay", () => {
    expect(
      accountsSummary([
        { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
        { balanceMinor: -45_000, currency: "EUR", type: "CARD" },
      ])
    ).toEqual({ availableBalanceMinor: 75_000, currency: "EUR" });
  });

  it("has nothing available from a card alone", () => {
    expect(
      accountsSummary([
        { balanceMinor: -45_000, currency: "EUR", type: "CARD" },
      ])
    ).toEqual({ availableBalanceMinor: null, currency: "EUR" });
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
