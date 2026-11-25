import { describe, expect, it } from "bun:test";

import { exchangeRateOf, originalAmountOf } from "./transaction";
import type { Transaction } from "./transaction";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  amount: -9213,
  category: "groceries",
  counterpartyName: "Shop",
  currency: "EUR",
  date: "2026-09-08T00:00:00.000Z",
  derivedCategory: "groceries",
  description: "SHOP",
  id: "tx",
  normalisedDescriptor: "shop",
  originalAmount: -10_000,
  originalCurrency: "USD",
  ...overrides,
});

describe("a purchase made in another currency", () => {
  it("keeps the amount it was made in", () => {
    expect(originalAmountOf(transaction())).toEqual({
      amountMinor: -10_000,
      currency: "USD",
    });
  });

  it("reads the rate as one unit of the original currency in the account's", () => {
    expect(exchangeRateOf(transaction())).toBeCloseTo(0.9213, 6);
  });

  it("weighs each side by its own minor units", () => {
    const inYen = transaction({
      amount: -6130,
      originalAmount: -10_000,
      originalCurrency: "JPY",
    });

    expect(exchangeRateOf(inYen)).toBeCloseTo(0.00613, 8);
  });

  it("has no original amount when it was made in the account's currency", () => {
    const local = transaction({
      originalAmount: -9213,
      originalCurrency: "EUR",
    });

    expect(originalAmountOf(local)).toBeNull();
    expect(exchangeRateOf(local)).toBeNull();
  });

  it("has no rate for an original amount of zero", () => {
    expect(exchangeRateOf(transaction({ originalAmount: 0 }))).toBeNull();
  });
});
