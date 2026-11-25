import { describe, expect, it } from "bun:test";

import { converterOf } from "../fx/converter";
import { rateBookOf } from "../fx/rate-book";
import {
  balanceHistory,
  monthEndsBefore,
  unconvertedHistoryCurrencies,
} from "./balance-history";

const today = new Date("2026-11-18T10:00:00.000Z");
const euros = converterOf("EUR", rateBookOf([]));

const dollars = converterOf(
  "EUR",
  rateBookOf([
    {
      currency: "USD",
      date: new Date("2026-10-30T00:00:00Z"),
      ratePerEur: 1.25,
    },
    {
      currency: "USD",
      date: new Date("2026-11-17T00:00:00Z"),
      ratePerEur: 1.1,
    },
  ])
);

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
        [
          {
            balanceMinor: 100_000,
            currency: "EUR",
            id: "checking",
            type: "CHECKING",
          },
        ],
        [
          {
            accountId: "checking",
            amount: -20_000,
            currency: "EUR",
            date: new Date("2026-10-15T00:00:00.000Z"),
          },
          {
            accountId: "checking",
            amount: 50_000,
            currency: "EUR",
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
        ],
        euros,
        today,
        2
      )
    ).toEqual([
      { balanceMinor: 70_000, date: "2026-09-30" },
      { balanceMinor: 50_000, date: "2026-10-31" },
      { balanceMinor: 100_000, date: "2026-11-18" },
    ]);
  });

  it("leaves out accounts with no balance or in a currency with no rate", () => {
    expect(
      balanceHistory(
        [
          {
            balanceMinor: 10_000,
            currency: "EUR",
            id: "eur",
            type: "CHECKING",
          },
          {
            balanceMinor: 99_999,
            currency: "USD",
            id: "usd",
            type: "CHECKING",
          },
          {
            balanceMinor: null,
            currency: "EUR",
            id: "unknown",
            type: "CHECKING",
          },
        ],
        [
          {
            accountId: "usd",
            amount: 5000,
            currency: "USD",
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
        ],
        euros,
        today,
        1
      )
    ).toEqual([
      { balanceMinor: 10_000, date: "2026-10-31" },
      { balanceMinor: 10_000, date: "2026-11-18" },
    ]);
  });

  it("takes a loan off the total even when the bank reports what is left to repay", () => {
    expect(
      balanceHistory(
        [
          {
            balanceMinor: 100_000,
            currency: "EUR",
            id: "checking",
            type: "CHECKING",
          },
          {
            balanceMinor: 900_000,
            currency: "EUR",
            id: "mortgage",
            type: "LOAN",
          },
        ],
        [
          {
            accountId: "mortgage",
            amount: -10_000,
            currency: "EUR",
            date: new Date("2026-11-05T00:00:00.000Z"),
          },
        ],
        euros,
        today,
        1
      )
    ).toEqual([
      { balanceMinor: -810_000, date: "2026-10-31" },
      { balanceMinor: -800_000, date: "2026-11-18" },
    ]);
  });

  it("converts each month end at the rate of that day", () => {
    expect(
      balanceHistory(
        [
          {
            balanceMinor: 110_000,
            currency: "USD",
            id: "usd",
            type: "CHECKING",
          },
        ],
        [
          {
            accountId: "usd",
            amount: -15_000,
            currency: "USD",
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
        ],
        dollars,
        today,
        1
      )
    ).toEqual([
      { balanceMinor: 100_000, date: "2026-10-31" },
      { balanceMinor: 100_000, date: "2026-11-18" },
    ]);
  });

  it("rewinds each currency an account holds with its own transactions", () => {
    expect(
      balanceHistory(
        [
          {
            balanceMinor: null,
            balances: [
              { balanceAt: today, balanceMinor: 50_000, currency: "EUR" },
              { balanceAt: today, balanceMinor: 11_000, currency: "USD" },
            ],
            currency: "EUR",
            id: "multi",
            type: "CHECKING",
          },
        ],
        [
          {
            accountId: "multi",
            amount: 10_000,
            currency: "EUR",
            date: new Date("2026-11-02T00:00:00.000Z"),
          },
          {
            accountId: "multi",
            amount: -5500,
            currency: "USD",
            date: new Date("2026-11-03T00:00:00.000Z"),
          },
        ],
        dollars,
        today,
        1
      )
    ).toEqual([
      { balanceMinor: 53_200, date: "2026-10-31" },
      { balanceMinor: 60_000, date: "2026-11-18" },
    ]);
  });

  it("has no history when no account carries a balance", () => {
    expect(balanceHistory([], [], euros, today, 6)).toBeNull();
  });
});

describe("unconvertedHistoryCurrencies", () => {
  it("lists the currencies held with no rate, once and sorted", () => {
    expect(
      unconvertedHistoryCurrencies(
        [
          { balanceMinor: 100, currency: "EUR", id: "a", type: "CHECKING" },
          { balanceMinor: 100, currency: "USD", id: "b", type: "CHECKING" },
          { balanceMinor: 100, currency: "JPY", id: "c", type: "SAVINGS" },
          { balanceMinor: 100, currency: "GBP", id: "d", type: "CHECKING" },
          { balanceMinor: 100, currency: "GBP", id: "e", type: "SAVINGS" },
        ],
        dollars,
        today
      )
    ).toEqual(["GBP", "JPY"]);
  });
});
