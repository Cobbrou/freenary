import { describe, expect, it } from "bun:test";

import type { CategoriseInput } from "../types";
import { classificationInputFrom } from "./payload";

const input = (overrides: Partial<CategoriseInput>): CategoriseInput => ({
  amountMinor: -1500,
  bankTransactionCode: "CARTE",
  channel: "card",
  counterpartyName: "CARREFOUR MARKET",
  country: "FR",
  creditorIban: "FR7630006000011234567890189",
  currency: "EUR",
  merchantKey: "carrefour market",
  normalisedDescriptor: "carrefour market paris",
  path: "card",
  rawDescriptor: "CARTE 12/03 CARREFOUR MARKET PARIS",
  userId: "test-user",
  ...overrides,
});

describe("classificationInputFrom", () => {
  it("sends exactly the ten allowed fields", () => {
    const payload = classificationInputFrom(input({}));

    expect(Object.keys(payload ?? {}).toSorted()).toEqual([
      "amountBucket",
      "channel",
      "counterpartyName",
      "country",
      "currency",
      "direction",
      "merchantCategoryCode",
      "merchantKey",
      "normalisedDescriptor",
      "path",
    ]);
  });

  it("never carries the amount, the user, the raw descriptor, the IBAN or the bank code", () => {
    const payload = classificationInputFrom(input({}));
    const serialised = JSON.stringify(payload);

    expect(serialised).not.toContain("FR7630006000011234567890189");
    expect(serialised).not.toContain("test-user");
    expect(serialised).not.toContain("CARTE 12/03");
    expect(serialised).not.toContain("1500");
  });

  it("buckets the amount and reads its direction", () => {
    expect(
      classificationInputFrom(input({ amountMinor: -4599 }))
    ).toMatchObject({ amountBucket: "small", direction: "debit" });

    expect(
      classificationInputFrom(input({ amountMinor: 250_000 }))
    ).toMatchObject({ amountBucket: "large", direction: "credit" });

    expect(classificationInputFrom(input({ amountMinor: -50 }))).toMatchObject({
      amountBucket: "micro",
    });

    expect(
      classificationInputFrom(input({ amountMinor: -10_000 }))
    ).toMatchObject({ amountBucket: "medium" });
  });

  it("buckets by the amount in euros when it is given", () => {
    expect(
      classificationInputFrom(
        input({
          amountMinor: -150_000,
          currency: "JPY",
          referenceAmountMinor: -90_000,
        })
      )
    ).toMatchObject({
      amountBucket: "large",
      currency: "JPY",
      direction: "debit",
    });

    expect(
      classificationInputFrom(
        input({
          amountMinor: -1500,
          currency: "JPY",
          referenceAmountMinor: -900,
        })
      )
    ).toMatchObject({ amountBucket: "micro" });
  });

  it("buckets by the booked amount when no amount in euros is known", () => {
    expect(
      classificationInputFrom(
        input({ amountMinor: -4599, referenceAmountMinor: null })
      )
    ).toMatchObject({ amountBucket: "small" });
  });

  it("nulls an absent merchant key rather than sending an empty string", () => {
    expect(classificationInputFrom(input({ merchantKey: "" }))).toMatchObject({
      merchantKey: null,
    });
  });

  it("drops the merchant key on the IBAN path, where it is the account number", () => {
    const ibanPath = input({
      merchantKey: "FR7630006000011234567890189",
      normalisedDescriptor: "loyer juin",
      path: "iban",
    });

    expect(classificationInputFrom(ibanPath)).toMatchObject({
      counterpartyName: "CARREFOUR MARKET",
      merchantKey: null,
      normalisedDescriptor: "loyer juin",
    });

    expect(JSON.stringify(classificationInputFrom(ibanPath))).not.toContain(
      "FR76"
    );
  });

  it("refuses an IBAN-path transaction whose descriptor says nothing", () => {
    expect(
      classificationInputFrom(
        input({
          counterpartyName: null,
          merchantKey: "FR7630006000011234567890189",
          normalisedDescriptor: "",
          path: "iban",
        })
      )
    ).toBeNull();
  });

  it("refuses a transaction with neither a key, a descriptor nor a counterparty", () => {
    expect(
      classificationInputFrom(
        input({
          counterpartyName: null,
          merchantKey: "",
          normalisedDescriptor: "",
        })
      )
    ).toBeNull();
  });

  it("describes a transaction by its counterparty when nothing else names it", () => {
    expect(
      classificationInputFrom(
        input({
          merchantKey: "FR7630006000011234567890189",
          normalisedDescriptor: "",
          path: "iban",
        })
      )
    ).toMatchObject({
      merchantKey: null,
      normalisedDescriptor: "carrefour market",
    });
  });
});
