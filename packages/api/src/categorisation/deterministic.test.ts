import { describe, expect, it } from "bun:test";

import type { SpendingCategory } from "../lib/taxonomy";
import { deterministicCategory, readsAsRefund } from "./deterministic";
import type { CategoriseInput } from "./types";

const input = (overrides: Partial<CategoriseInput>): CategoriseInput => ({
  amountMinor: -1500,
  channel: "card",
  currency: "EUR",
  merchantKey: "unknown-merchant-xyz-abc",
  normalisedDescriptor: "unknown merchant xyz abc",
  path: "card",
  rawDescriptor: "CARTE 12/03 UNKNOWN MERCHANT XYZ ABC",
  userId: "test-user",
  ...overrides,
});

describe("deterministicCategory", () => {
  it("returns null when the transaction carries no deterministic signal", () => {
    expect(deterministicCategory(input({}))).toBeNull();
  });

  it("prefers the merchant category code over the bank code table", () => {
    const assigned = deterministicCategory(
      input({
        bankTransactionCode: "PRLV LOYER",
        country: "FR",
        merchantCategoryCode: "5411",
      })
    );

    expect(assigned).toEqual({
      category: "groceries",
      confidence: 0.8,
      stage: "mcc",
    });
  });

  it("applies the country layer for a supported country", () => {
    const assigned = deterministicCategory(
      input({ bankTransactionCode: "PRLV LOYER", country: "FR" })
    );

    expect(assigned?.category).toBe("rent-mortgage");
    expect(assigned?.stage).toBe("rules");
  });

  it("reads no semantics out of the descriptor or the counterparty", () => {
    expect(
      deterministicCategory(
        input({
          counterpartyName: "PHARMACIE DU CENTRE",
          country: "FR",
          normalisedDescriptor: "netflix com",
        })
      )
    ).toBeNull();
  });

  it("still matches the inflected forms banks actually write", () => {
    const cases: [string, SpendingCategory, string | null][] = [
      ["PRLV IMPOTS", "taxes", "FR"],
      ["VIREMENT LOYERS", "rent-mortgage", "FR"],
      ["VIREMENT SALAIRES", "salary", "FR"],
      ["SKATTEVERKET", "taxes", null],
    ];

    for (const [bankTransactionCode, category, country] of cases) {
      expect(
        deterministicCategory(
          input({ amountMinor: -1000, bankTransactionCode, country })
        )?.category
      ).toBe(category);
    }
  });

  it("anchors non-ASCII keywords too", () => {
    expect(
      deterministicCategory(
        input({ amountMinor: 250_000, bankTransactionCode: "LÖNER" })
      )?.category
    ).toBe("salary");
  });

  it("names no category for a word that only says money moved", () => {
    const wordsThatNameNoCategory = [
      "VIREMENT",
      "ÖVERFÖRING",
      "transfer",
      "PRLV ASSURANCES",
      "FÖRSÄKRING",
    ];

    for (const bankTransactionCode of wordsThatNameNoCategory) {
      expect(
        deterministicCategory(input({ bankTransactionCode, country: "FR" }))
      ).toBeNull();

      expect(
        deterministicCategory(
          input({ amountMinor: 250_000, bankTransactionCode, country: "FR" })
        )
      ).toBeNull();
    }
  });

  it("rejects an expense keyword on a credit — that is a refund", () => {
    expect(
      deterministicCategory(
        input({
          amountMinor: 1500,
          bankTransactionCode: "PRLV LOYER",
          country: "FR",
        })
      )
    ).toBeNull();
  });

  it("rejects a merchant category code on a credit — that is a refund", () => {
    expect(
      deterministicCategory(
        input({ amountMinor: 1500, merchantCategoryCode: "5411" })
      )
    ).toBeNull();
  });

  it("falls through to the bank code when the merchant category code reads as a refund", () => {
    const assigned = deterministicCategory(
      input({
        amountMinor: 250_000,
        bankTransactionCode: "VIREMENT SALAIRE",
        country: "FR",
        merchantCategoryCode: "5411",
      })
    );

    expect(assigned?.category).toBe("salary");
  });

  it("accepts an income keyword on a credit", () => {
    const assigned = deterministicCategory(
      input({
        amountMinor: 250_000,
        bankTransactionCode: "VIREMENT SALAIRE",
        country: "FR",
      })
    );

    expect(assigned?.category).toBe("salary");
  });
});

describe("readsAsRefund", () => {
  const CREDIT_MINOR = 1500;
  const DEBIT_MINOR = -1500;

  it("reads a credit on an outgoing-only category as a refund", () => {
    expect(readsAsRefund("groceries", CREDIT_MINOR)).toBe(true);
    expect(readsAsRefund("savings", CREDIT_MINOR)).toBe(true);
  });

  it("leaves a both-direction category alone on a credit", () => {
    expect(readsAsRefund("people", CREDIT_MINOR)).toBe(false);
    expect(readsAsRefund("cash-withdrawal", CREDIT_MINOR)).toBe(false);
    expect(readsAsRefund("uncategorised", CREDIT_MINOR)).toBe(false);
  });

  it("leaves an incoming category alone on a credit", () => {
    expect(readsAsRefund("salary", CREDIT_MINOR)).toBe(false);
  });

  it("never fires on a debit", () => {
    expect(readsAsRefund("groceries", DEBIT_MINOR)).toBe(false);
    expect(readsAsRefund("salary", DEBIT_MINOR)).toBe(false);
  });
});
