import { describe, expect, it } from "bun:test";

import { converterOf } from "../fx/converter";
import { rateBookOf } from "../fx/rate-book";
import { accountsSummary, detectedCurrencyOf } from "./accounts-summary";

const euros = converterOf("EUR", rateBookOf([]));
const MAY_FIFTH = new Date("2026-05-05T00:00:00Z");
const JUNE_FIRST = new Date("2026-06-01T00:00:00Z");

const dollars = converterOf(
  "EUR",
  rateBookOf([
    {
      currency: "USD",
      date: new Date("2026-05-01T00:00:00Z"),
      ratePerEur: 1.1,
    },
    {
      currency: "USD",
      date: new Date("2026-06-01T00:00:00Z"),
      ratePerEur: 1.2,
    },
  ])
);

describe("accountsSummary", () => {
  it("counts only checking accounts as available", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 500_000, currency: "EUR", type: "SAVINGS" },
          { balanceMinor: -900_000, currency: "EUR", type: "LOAN" },
        ],
        euros
      )
    ).toEqual({
      availableBalanceMinor: 120_000,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("leaves out every savings account, regulated or not, and every investment", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 2_295_000, currency: "EUR", type: "LIVRET_A" },
          { balanceMinor: 1_200_000, currency: "EUR", type: "LDDS" },
          { balanceMinor: 600_000, currency: "EUR", type: "PEL" },
          { balanceMinor: 900_000, currency: "EUR", type: "PEA" },
        ],
        euros
      )
    ).toEqual({
      availableBalanceMinor: 120_000,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("takes off the deferred card spending the current account will pay", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: -45_000, currency: "EUR", type: "CARD" },
        ],
        euros
      )
    ).toEqual({
      availableBalanceMinor: 75_000,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("has nothing available from a card alone", () => {
    expect(
      accountsSummary(
        [{ balanceMinor: -45_000, currency: "EUR", type: "CARD" }],
        euros
      )
    ).toEqual({
      availableBalanceMinor: null,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("converts an account in another currency when a rate exists", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 30_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 88_000, currency: "USD", type: "CHECKING" },
        ],
        dollars,
        MAY_FIFTH
      )
    ).toEqual({
      availableBalanceMinor: 230_000,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("leaves out and counts an account in a currency with no rate", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: 120_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 30_000, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 80_000, currency: "USD", type: "CHECKING" },
        ],
        euros
      )
    ).toEqual({
      availableBalanceMinor: 150_000,
      currency: "EUR",
      unconvertedBalanceCount: 1,
    });
  });

  it("adds every currency an account holds", () => {
    expect(
      accountsSummary(
        [
          {
            balanceMinor: null,
            balances: [
              { balanceAt: MAY_FIFTH, balanceMinor: 50_000, currency: "EUR" },
              { balanceAt: MAY_FIFTH, balanceMinor: 11_000, currency: "USD" },
            ],
            currency: "EUR",
            type: "CHECKING",
          },
        ],
        dollars,
        MAY_FIFTH
      )
    ).toEqual({
      availableBalanceMinor: 60_000,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });

  it("converts at the rate of the day it is asked for", () => {
    expect(
      accountsSummary(
        [{ balanceMinor: 12_000, currency: "USD", type: "CHECKING" }],
        dollars,
        JUNE_FIRST
      ).availableBalanceMinor
    ).toBe(10_000);
  });

  it("is null when no checking account reports a balance", () => {
    expect(
      accountsSummary(
        [
          { balanceMinor: null, currency: "EUR", type: "CHECKING" },
          { balanceMinor: 500_000, currency: "EUR", type: "SAVINGS" },
        ],
        euros
      )
    ).toEqual({
      availableBalanceMinor: null,
      currency: "EUR",
      unconvertedBalanceCount: 0,
    });
  });
});

describe("detectedCurrencyOf", () => {
  it("prefers the currency of the checking accounts", () => {
    expect(
      detectedCurrencyOf([
        { currency: "USD", type: "CHECKING" },
        { currency: "EUR", type: "SAVINGS" },
        { currency: "EUR", type: "BROKERAGE" },
      ])
    ).toBe("USD");
  });

  it("falls back to every account when no checking account has a currency", () => {
    expect(
      detectedCurrencyOf([
        { currency: null, type: "CHECKING" },
        { currency: "GBP", type: "SAVINGS" },
      ])
    ).toBe("GBP");
  });

  it("falls back to euros when no account has a currency", () => {
    expect(detectedCurrencyOf([{ currency: null, type: "CHECKING" }])).toBe(
      "EUR"
    );
  });
});
