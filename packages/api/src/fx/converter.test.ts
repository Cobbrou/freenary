import { describe, expect, it } from "bun:test";

import { convertRows, converterOf } from "./converter";
import { rateBookOf } from "./rate-book";

const MAY_FIRST = new Date("2026-05-01T00:00:00Z");
const MAY_FIFTH = new Date("2026-05-05T00:00:00Z");

const euros = converterOf(
  "EUR",
  rateBookOf([{ currency: "USD", date: MAY_FIRST, ratePerEur: 1.1 }])
);

describe("converterOf", () => {
  it("passes an amount in the reporting currency through", () => {
    expect(
      euros.amountOf({ amount: -1234, currency: "EUR", date: MAY_FIFTH })
    ).toBe(-1234);
  });

  it("prefers the amount the bank converted into the reporting currency", () => {
    expect(
      euros.amountOf({
        amount: -1100,
        currency: "USD",
        date: MAY_FIFTH,
        originalAmount: 1050,
        originalCurrency: "EUR",
      })
    ).toBe(-1050);

    expect(
      euros.amountOf({
        amount: 1100,
        currency: "USD",
        date: MAY_FIFTH,
        originalAmount: -1050,
        originalCurrency: "EUR",
      })
    ).toBe(1050);
  });

  it("uses the reference rate when the original is in another currency", () => {
    expect(
      euros.amountOf({
        amount: -1100,
        currency: "USD",
        date: MAY_FIFTH,
        originalAmount: 900,
        originalCurrency: "GBP",
      })
    ).toBe(-1000);
  });

  it("has no amount when no rate covers the day", () => {
    expect(
      euros.amountOf({
        amount: -1100,
        currency: "USD",
        date: new Date("2026-04-01T00:00:00Z"),
      })
    ).toBeNull();
  });

  it("converts a bare amount and carries its currency and rate date", () => {
    expect(euros.convert(2200, "USD", MAY_FIFTH)).toBe(2000);
    expect(euros.currency).toBe("EUR");
    expect(euros.ratesAsOf).toEqual(MAY_FIRST);
  });
});

describe("convertRows", () => {
  it("converts what it can, keeps the other fields and counts the rest", () => {
    expect(
      convertRows(
        [
          { amount: -500, currency: "EUR", date: MAY_FIFTH, id: "a" },
          { amount: -1100, currency: "USD", date: MAY_FIFTH, id: "b" },
          { amount: -900, currency: "GBP", date: MAY_FIFTH, id: "c" },
        ],
        euros
      )
    ).toEqual({
      rows: [
        { amount: -500, currency: "EUR", date: MAY_FIFTH, id: "a" },
        { amount: -1000, currency: "USD", date: MAY_FIFTH, id: "b" },
      ],
      unconvertedCount: 1,
    });
  });
});
