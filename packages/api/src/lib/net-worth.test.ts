import { describe, expect, it } from "bun:test";

import { currentAccountsOf, holdingsSummaryOf, netWorthOf } from "./net-worth";

const MAY_FIRST = new Date("2026-05-01T08:00:00Z");
const MAY_SECOND = new Date("2026-05-02T08:00:00Z");

describe("netWorthOf", () => {
  it("adds assets by class and takes debts off the total", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: MAY_FIRST,
          balanceMinor: 120_000,
          currency: "EUR",
          type: "CHECKING",
        },
        {
          balanceAt: MAY_SECOND,
          balanceMinor: 500_000,
          currency: "EUR",
          type: "SAVINGS",
        },
        {
          balanceAt: MAY_FIRST,
          balanceMinor: 300_000,
          currency: "EUR",
          type: "BROKERAGE",
        },
        {
          balanceAt: MAY_FIRST,
          balanceMinor: 200_000,
          currency: "EUR",
          type: "LIFE_INSURANCE",
        },
        {
          balanceAt: MAY_FIRST,
          balanceMinor: -900_000,
          currency: "EUR",
          type: "LOAN",
        },
      ],
      "EUR"
    );

    expect(worth).toEqual({
      assetClasses: [
        { amountMinor: 120_000, assetClass: "cash" },
        { amountMinor: 500_000, assetClass: "savings" },
        { amountMinor: 500_000, assetClass: "investments" },
      ],
      assetsMinor: 1_120_000,
      balancesAt: MAY_SECOND,
      excludedAccountCount: 0,
      liabilitiesMinor: 900_000,
      netWorthMinor: 220_000,
    });
  });

  it("counts an overdrawn current account as a debt", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: null,
          balanceMinor: -5000,
          currency: "EUR",
          type: "CHECKING",
        },
      ],
      "EUR"
    );

    expect(worth.assetClasses).toEqual([]);
    expect(worth.liabilitiesMinor).toBe(5000);
    expect(worth.netWorthMinor).toBe(-5000);
  });

  it("counts a loan and a deferred card as debts whatever sign the bank reports", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: null,
          balanceMinor: 100_000,
          currency: "EUR",
          type: "CHECKING",
        },
        {
          balanceAt: null,
          balanceMinor: 900_000,
          currency: "EUR",
          type: "LOAN",
        },
        {
          balanceAt: null,
          balanceMinor: -30_000,
          currency: "EUR",
          type: "CARD",
        },
      ],
      "EUR"
    );

    expect(worth.assetsMinor).toBe(100_000);
    expect(worth.liabilitiesMinor).toBe(930_000);
    expect(worth.netWorthMinor).toBe(-830_000);
  });

  it("keeps locked retirement savings apart from what can be withdrawn", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: null,
          balanceMinor: 400_000,
          currency: "EUR",
          type: "LIVRET_A",
        },
        {
          balanceAt: null,
          balanceMinor: 200_000,
          currency: "EUR",
          type: "PEL",
        },
        {
          balanceAt: null,
          balanceMinor: 300_000,
          currency: "EUR",
          type: "PEA",
        },
        {
          balanceAt: null,
          balanceMinor: 150_000,
          currency: "EUR",
          type: "RETIREMENT",
        },
        {
          balanceAt: null,
          balanceMinor: 50_000,
          currency: "EUR",
          type: "EMPLOYEE_SAVINGS",
        },
      ],
      "EUR"
    );

    expect(worth.assetClasses).toEqual([
      { amountMinor: 600_000, assetClass: "savings" },
      { amountMinor: 300_000, assetClass: "investments" },
      { amountMinor: 200_000, assetClass: "retirement" },
    ]);

    expect(worth.netWorthMinor).toBe(1_100_000);
  });

  it("leaves out accounts in another currency or with no balance", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: null,
          balanceMinor: 10_000,
          currency: "EUR",
          type: "CHECKING",
        },
        {
          balanceAt: null,
          balanceMinor: 80_000,
          currency: "USD",
          type: "CHECKING",
        },
        {
          balanceAt: null,
          balanceMinor: null,
          currency: "EUR",
          type: "SAVINGS",
        },
      ],
      "EUR"
    );

    expect(worth.netWorthMinor).toBe(10_000);
    expect(worth.excludedAccountCount).toBe(2);
  });

  it("has no total when no account reports a balance", () => {
    const worth = netWorthOf(
      [
        {
          balanceAt: null,
          balanceMinor: null,
          currency: "EUR",
          type: "CHECKING",
        },
      ],
      "EUR"
    );

    expect(worth.netWorthMinor).toBeNull();
    expect(worth.balancesAt).toBeNull();
  });
});

describe("holdingsSummaryOf", () => {
  it("sums value and gain, and ranks the largest holdings", () => {
    const summary = holdingsSummaryOf(
      [
        {
          currency: "EUR",
          id: "a",
          label: "World ETF",
          unrealisedGainMinor: 20_000,
          valuationMinor: 120_000,
        },
        {
          currency: "EUR",
          id: "b",
          label: "Euro fund",
          unrealisedGainMinor: -5000,
          valuationMinor: 45_000,
        },
        {
          currency: "EUR",
          id: "c",
          label: "Bond fund",
          unrealisedGainMinor: null,
          valuationMinor: 60_000,
        },
        {
          currency: "EUR",
          id: "d",
          label: "Small cap",
          unrealisedGainMinor: 1000,
          valuationMinor: 10_000,
        },
        {
          currency: "USD",
          id: "e",
          label: "US stock",
          unrealisedGainMinor: 9000,
          valuationMinor: 900_000,
        },
      ],
      "EUR"
    );

    expect(summary.valuationMinor).toBe(235_000);
    expect(summary.unrealisedGainMinor).toBe(16_000);
    expect(summary.costBasisMinor).toBe(159_000);
    expect(summary.holdingCount).toBe(4);
    expect(summary.topHoldings.map((holding) => holding.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("reports no gain when no holding carries one", () => {
    const summary = holdingsSummaryOf(
      [
        {
          currency: "EUR",
          id: "a",
          label: "Fund",
          unrealisedGainMinor: null,
          valuationMinor: 1000,
        },
      ],
      "EUR"
    );

    expect(summary.unrealisedGainMinor).toBeNull();
    expect(summary.costBasisMinor).toBeNull();
  });
});

describe("currentAccountsOf", () => {
  it("dates the balance by the checking accounts it adds up, not by the others", () => {
    expect(
      currentAccountsOf([
        {
          balanceAt: MAY_FIRST,
          balanceMinor: 120_000,
          currency: "EUR",
          type: "CHECKING",
        },
        {
          balanceAt: MAY_SECOND,
          balanceMinor: 500_000,
          currency: "EUR",
          type: "BROKERAGE",
        },
      ])
    ).toEqual({
      balanceMinor: 120_000,
      balancesAt: MAY_FIRST,
      currency: "EUR",
    });
  });

  it("takes off what a deferred card has spent but leaves savings out", () => {
    expect(
      currentAccountsOf([
        {
          balanceAt: MAY_FIRST,
          balanceMinor: 120_000,
          currency: "EUR",
          type: "CHECKING",
        },
        {
          balanceAt: MAY_SECOND,
          balanceMinor: -20_000,
          currency: "EUR",
          type: "CARD",
        },
        {
          balanceAt: MAY_SECOND,
          balanceMinor: 500_000,
          currency: "EUR",
          type: "LIVRET_A",
        },
      ])
    ).toEqual({
      balanceMinor: 100_000,
      balancesAt: MAY_SECOND,
      currency: "EUR",
    });
  });

  it("has no date when no checking account reports a balance", () => {
    expect(
      currentAccountsOf([
        {
          balanceAt: MAY_SECOND,
          balanceMinor: null,
          currency: "EUR",
          type: "CHECKING",
        },
      ])
    ).toEqual({ balanceMinor: null, balancesAt: null, currency: "EUR" });
  });
});
