import { describe, expect, test } from "bun:test";

import type { EBTransaction } from "./client";
import { mapEBTransactions, parseMinorUnits } from "./map-transaction";

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
      "2026-01-01"
    );

    expect(mapped?.balanceAfterMinor).toBe(-8000);
  });

  test("maps the top-level creditor agent", () => {
    const [mapped] = mapEBTransactions(
      [transaction("volatile-id")],
      "2026-01-01"
    );

    expect(mapped?.creditorAgentBic).toBe("BANKFRPP");
  });

  test("uses entry_reference as the authoritative identity", () => {
    const [mapped] = mapEBTransactions(
      [{ ...transaction("volatile-id"), entry_reference: "entry-123" }],
      "2026-01-01"
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
      "2026-08-27"
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
      "2026-08-27"
    );

    expect(mapped?.bookingDate).toBe("2026-08-26");
  });

  test("dates a transaction with no bank date on the fallback date", () => {
    const [mapped] = mapEBTransactions(
      [{ ...transaction("pending"), booking_date: undefined }],
      "2026-08-27"
    );

    expect(mapped?.bookingDate).toBe("2026-08-27");
  });

  test("does not include transaction_id in a derived identity", () => {
    const [first] = mapEBTransactions([transaction("first")], "2026-01-01");
    const [second] = mapEBTransactions([transaction("second")], "2026-01-01");

    expect(first?.providerTransactionId).toBe(second?.providerTransactionId);
  });

  test("assigns distinct stable ordinals to exact duplicates", () => {
    const mapped = mapEBTransactions(
      [transaction("first"), transaction("second")],
      "2026-01-01"
    );

    const remapped = mapEBTransactions(
      [transaction("changed-first"), transaction("changed-second")],
      "2026-01-01"
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
