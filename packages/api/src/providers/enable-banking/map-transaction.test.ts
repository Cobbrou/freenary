import { describe, expect, test } from "bun:test";

import type { EBTransaction } from "./client";
import {
  mapEBTransactions,
  normaliseAmount,
  parseMinorUnits,
} from "./map-transaction";

const transaction = (transactionId: string): EBTransaction => ({
  booking_date: "2026-08-27",
  credit_debit_indicator: "DBIT",
  creditor: { name: "Coffee shop" },
  creditor_agent: { bic_fi: "BANKFRPP" },
  remittance_information: ["Coffee"],
  transaction_amount: { amount: "4.20", currency: "EUR" },
  transaction_id: transactionId,
});

describe("parseMinorUnits", () => {
  test("keeps the sign of a signed amount with no indicator", () => {
    expect(parseMinorUnits("-12.50")).toBe(-1250);
  });

  test("lets a leading minus win over the indicator", () => {
    expect(parseMinorUnits("-12.50", "DBIT")).toBe(-1250);
    expect(parseMinorUnits("-12.50", "CRDT")).toBe(-1250);
  });

  test("takes the sign from the indicator when the amount is unsigned", () => {
    expect(parseMinorUnits("12.50", "DBIT")).toBe(-1250);
    expect(parseMinorUnits("12.50", "CRDT")).toBe(1250);
  });
});

describe("mapEBTransactions", () => {
  test("keeps a negative balance after the transaction negative", () => {
    const [mapped] = mapEBTransactions(
      [
        {
          ...transaction("overdrawn"),
          balance_after_transaction: { amount: "-80.00", currency: "EUR" },
        },
      ],
      "2026-01-01",
      "EUR"
    );

    expect(mapped?.balanceAfterMinor).toBe(-8000);
  });

  test("maps the top-level creditor agent", () => {
    const [mapped] = mapEBTransactions(
      [transaction("volatile-id")],
      "2026-01-01",
      "EUR"
    );

    expect(mapped?.creditorAgentBic).toBe("BANKFRPP");
  });

  test("uses entry_reference as the authoritative identity", () => {
    const [mapped] = mapEBTransactions(
      [{ ...transaction("volatile-id"), entry_reference: "entry-123" }],
      "2026-01-01",
      "EUR"
    );

    expect(mapped?.providerTransactionId).toBe("entry-123");
  });

  test("dates a transaction with no booking date on its transaction date", () => {
    const [mapped] = mapEBTransactions(
      [
        {
          ...transaction("pending"),
          booking_date: undefined,
          transaction_date: "2026-08-25",
          value_date: "2026-08-26",
        },
      ],
      "2026-08-27",
      "EUR"
    );

    expect(mapped?.bookingDate).toBe("2026-08-25");
  });

  test("dates a transaction with no booking or transaction date on its value date", () => {
    const [mapped] = mapEBTransactions(
      [
        {
          ...transaction("pending"),
          booking_date: undefined,
          value_date: "2026-08-26",
        },
      ],
      "2026-08-27",
      "EUR"
    );

    expect(mapped?.bookingDate).toBe("2026-08-26");
  });

  test("dates a transaction with no bank date on the fallback date", () => {
    const [mapped] = mapEBTransactions(
      [{ ...transaction("pending"), booking_date: undefined }],
      "2026-08-27",
      "EUR"
    );

    expect(mapped?.bookingDate).toBe("2026-08-27");
  });

  test("does not include transaction_id in a derived identity", () => {
    const [first] = mapEBTransactions(
      [transaction("first")],
      "2026-01-01",
      "EUR"
    );

    const [second] = mapEBTransactions(
      [transaction("second")],
      "2026-01-01",
      "EUR"
    );

    expect(first?.providerTransactionId).toBe(second?.providerTransactionId);
  });

  test("assigns distinct stable ordinals to exact duplicates", () => {
    const mapped = mapEBTransactions(
      [transaction("first"), transaction("second")],
      "2026-01-01",
      "EUR"
    );

    const remapped = mapEBTransactions(
      [transaction("changed-first"), transaction("changed-second")],
      "2026-01-01",
      "EUR"
    );

    expect(mapped[0]?.providerTransactionId).toMatch(/:1$/u);
    expect(mapped[1]?.providerTransactionId).toMatch(/:2$/u);
    expect(mapped[0]?.providerTransactionId).not.toBe(
      mapped[1]?.providerTransactionId
    );

    expect(remapped.map((item) => item.providerTransactionId)).toEqual(
      mapped.map((item) => item.providerTransactionId)
    );
  });
});

const foreign = (overrides: Partial<EBTransaction>): EBTransaction => ({
  ...transaction("foreign"),
  ...overrides,
});

describe("normaliseAmount", () => {
  test("keeps an amount in the account currency and its instructed foreign amount", () => {
    expect(
      normaliseAmount(
        foreign({
          exchange_rate: {
            instructed_amount: { amount: "25.00", currency: "USD" },
          },
          transaction_amount: { amount: "23.10", currency: "EUR" },
        }),
        "EUR"
      )
    ).toEqual({
      amountMinor: -2310,
      currency: "EUR",
      originalAmountMinor: -2500,
      originalCurrency: "USD",
    });
  });

  test("reads the instructed amount with its own currency's digits", () => {
    expect(
      normaliseAmount(
        foreign({
          exchange_rate: {
            instructed_amount: { amount: "1500", currency: "JPY" },
          },
          transaction_amount: { amount: "9.20", currency: "EUR" },
        }),
        null
      )
    ).toEqual({
      amountMinor: -920,
      currency: "EUR",
      originalAmountMinor: -1500,
      originalCurrency: "JPY",
    });
  });

  test("reports no original amount when the instructed amount is in the same currency", () => {
    expect(
      normaliseAmount(
        foreign({
          exchange_rate: {
            instructed_amount: { amount: "4.20", currency: "EUR" },
          },
        }),
        "EUR"
      )
    ).toEqual({ amountMinor: -420, currency: "EUR" });
  });

  test("books in the account currency when the instructed amount carries it", () => {
    expect(
      normaliseAmount(
        foreign({
          exchange_rate: {
            instructed_amount: { amount: "18.40", currency: "EUR" },
          },
          transaction_amount: { amount: "20.00", currency: "USD" },
        }),
        "EUR"
      )
    ).toEqual({
      amountMinor: -1840,
      currency: "EUR",
      originalAmountMinor: -2000,
      originalCurrency: "USD",
    });
  });

  test("converts with a rate quoted per unit of the foreign currency", () => {
    expect(
      normaliseAmount(
        foreign({
          exchange_rate: { exchange_rate: "0.92", unit_currency: "USD" },
          transaction_amount: { amount: "20.00", currency: "USD" },
        }),
        "EUR"
      )
    ).toEqual({
      amountMinor: -1840,
      currency: "EUR",
      originalAmountMinor: -2000,
      originalCurrency: "USD",
    });
  });

  test("converts with a rate quoted per unit of the account currency, rounding once", () => {
    expect(
      normaliseAmount(
        foreign({
          credit_debit_indicator: "CRDT",
          exchange_rate: { exchange_rate: "1.08", unit_currency: "EUR" },
          transaction_amount: { amount: "10.00", currency: "USD" },
        }),
        "EUR"
      )
    ).toEqual({
      amountMinor: 926,
      currency: "EUR",
      originalAmountMinor: 1000,
      originalCurrency: "USD",
    });
  });

  test("keeps a foreign amount in its own currency without a usable rate", () => {
    const booked = { amountMinor: -2000, currency: "USD" };

    expect(
      normaliseAmount(
        foreign({ transaction_amount: { amount: "20.00", currency: "USD" } }),
        "EUR"
      )
    ).toEqual(booked);

    expect(
      normaliseAmount(
        foreign({
          exchange_rate: { exchange_rate: "0.85", unit_currency: "GBP" },
          transaction_amount: { amount: "20.00", currency: "USD" },
        }),
        "EUR"
      )
    ).toEqual(booked);

    expect(
      normaliseAmount(
        foreign({
          exchange_rate: { exchange_rate: "n/a", unit_currency: "USD" },
          transaction_amount: { amount: "20.00", currency: "USD" },
        }),
        "EUR"
      )
    ).toEqual(booked);
  });
});

describe("mapEBTransactions in another currency", () => {
  test("reads the balance after the transaction in its own currency", () => {
    const [mapped] = mapEBTransactions(
      [
        foreign({
          balance_after_transaction: { amount: "125000", currency: "JPY" },
          transaction_amount: { amount: "12.34", currency: "EUR" },
        }),
      ],
      "2026-01-01",
      "EUR"
    );

    expect(mapped?.amountMinor).toBe(-1234);
    expect(mapped?.balanceAfterMinor).toBe(125_000);
  });

  test("keeps the raw rate and the identity of a converted transaction", () => {
    const raw = foreign({
      exchange_rate: { exchange_rate: "0.92", unit_currency: "USD" },
      transaction_amount: { amount: "20.00", currency: "USD" },
    });

    const [converted] = mapEBTransactions([raw], "2026-01-01", "EUR");
    const [unconverted] = mapEBTransactions([raw], "2026-01-01", null);

    expect(converted?.exchangeRate).toBe("0.92");
    expect(converted?.currency).toBe("EUR");
    expect(unconverted?.currency).toBe("USD");
    expect(converted?.providerTransactionId).toBe(
      unconverted?.providerTransactionId
    );
  });
});
