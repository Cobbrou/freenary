import { describe, expect, it } from "bun:test";

import type { Transaction } from "@/entities/budget";

import { exclusionActionsOf } from "./exclusion-actions";

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  amount: -2000,
  category: "groceries",
  counterpartyName: "Carrefour",
  currency: "EUR",
  date: "2026-10-01",
  derivedCategory: "groceries",
  description: "CB CARREFOUR",
  hasMerchant: true,
  id: "tx-1",
  normalisedDescriptor: "carrefour",
  ...overrides,
});

const scopesOf = (tx: Transaction) =>
  exclusionActionsOf(tx).map(({ isExcluded, scope }) => ({
    isExcluded,
    scope,
  }));

describe("exclusionActionsOf", () => {
  it("offers to exclude the merchant of a counted transaction", () => {
    expect(scopesOf(transaction({ exclusion: null }))).toEqual([
      { isExcluded: true, scope: "merchant" },
    ]);
  });

  it("offers to include the merchant again once it is excluded", () => {
    expect(scopesOf(transaction({ exclusion: "MERCHANT" }))).toEqual([
      { isExcluded: false, scope: "merchant" },
    ]);
  });

  it("offers nothing on a transaction its account excludes", () => {
    expect(scopesOf(transaction({ exclusion: "ACCOUNT" }))).toEqual([]);
  });
});
