import { describe, expect, test } from "bun:test";

import type { EBTransaction } from "./client";
import { mapEBTransactions } from "./map-transaction";

const transaction = (transactionId: string): EBTransaction => ({
  booking_date: "2026-08-27",
  credit_debit_indicator: "DBIT",
  creditor: { name: "Coffee shop" },
  creditor_agent: { bic_fi: "BANKFRPP" },
  remittance_information: ["Coffee"],
  transaction_amount: { amount: "4.20", currency: "EUR" },
  transaction_id: transactionId,
});

describe("mapEBTransactions", () => {
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
