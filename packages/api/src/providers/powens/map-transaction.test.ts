import { describe, expect, test } from "bun:test";

import { mapPowensTransaction, mapPowensTransactions } from "./map-transaction";

const transaction = (
  overrides: Partial<Parameters<typeof mapPowensTransaction>[0]>
) => ({ date: "2026-03-04", id: 1, value: -10, ...overrides });

describe("mapPowensTransaction", () => {
  test("converts a decimal amount to minor units of the account currency", () => {
    const mapped = mapPowensTransaction(
      transaction({ value: -56.78 }),
      "EUR",
      2
    );

    expect(mapped?.amountMinor).toBe(-5678);
    expect(mapped?.currency).toBe("EUR");
  });

  test("respects the currency's own precision", () => {
    expect(
      mapPowensTransaction(transaction({ value: -1234 }), "JPY", 0)?.amountMinor
    ).toBe(-1234);

    expect(
      mapPowensTransaction(transaction({ value: -1.234 }), "BHD", 3)
        ?.amountMinor
    ).toBe(-1234);
  });

  test("reads a direct debit's family code from the direction", () => {
    expect(
      mapPowensTransaction(transaction({ type: "order", value: -20 }), "EUR", 2)
        ?.bankTransactionFamilyCode
    ).toBe("IDDT");

    expect(
      mapPowensTransaction(transaction({ type: "order", value: 20 }), "EUR", 2)
        ?.bankTransactionFamilyCode
    ).toBe("RDDT");
  });

  test("maps card types to the card family code and keeps the raw type", () => {
    const mapped = mapPowensTransaction(
      transaction({ type: "deferred_card" }),
      "EUR",
      2
    );

    expect(mapped?.bankTransactionFamilyCode).toBe("CCRD");
    expect(mapped?.bankTransactionDescription).toBe("deferred_card");
  });

  test("leaves an unmapped type without a family code", () => {
    expect(
      mapPowensTransaction(transaction({ type: "arbitrage" }), "EUR", 2)
        ?.bankTransactionFamilyCode
    ).toBeUndefined();
  });

  test("takes the counterparty IBAN only from an iban scheme", () => {
    const withIban = mapPowensTransaction(
      transaction({
        counterparty: {
          account_identification: "FR7612345",
          account_scheme_name: "iban",
          label: "EDF",
          type: "creditor",
        },
      }),
      "EUR",
      2
    );

    expect(withIban?.creditorName).toBe("EDF");
    expect(withIban?.creditorIban).toBe("FR7612345");

    const otherScheme = mapPowensTransaction(
      transaction({
        counterparty: {
          account_identification: "12345678901",
          account_scheme_name: "bban",
          label: "EDF",
          type: "creditor",
        },
      }),
      "EUR",
      2
    );

    expect(otherScheme?.creditorName).toBe("EDF");
    expect(otherScheme?.creditorIban).toBeUndefined();
  });

  test("infers the counterparty side from the sign when the role is absent", () => {
    const incoming = mapPowensTransaction(
      transaction({ counterparty: { label: "Employer" }, value: 250 }),
      "EUR",
      2
    );

    expect(incoming?.debtorName).toBe("Employer");
    expect(incoming?.creditorName).toBeUndefined();
  });

  test("keeps both wordings, original first, without repeating one", () => {
    expect(
      mapPowensTransaction(
        transaction({ original_wording: "CB EDF 04/03", wording: "EDF" }),
        "EUR",
        2
      )?.remittanceLines
    ).toEqual(["CB EDF 04/03", "EDF"]);

    expect(
      mapPowensTransaction(
        transaction({ original_wording: "EDF", wording: "EDF" }),
        "EUR",
        2
      )?.remittanceLines
    ).toEqual(["EDF"]);
  });

  test("marks a coming transaction as pending", () => {
    expect(
      mapPowensTransaction(transaction({ coming: true }), "EUR", 2)?.status
    ).toBe("PDNG");

    expect(mapPowensTransaction(transaction({}), "EUR", 2)?.status).toBe(
      "BOOK"
    );
  });

  test("drops what cannot be booked", () => {
    expect(
      mapPowensTransaction(
        transaction({ deleted: "2026-03-05 10:00:00" }),
        "EUR",
        2
      )
    ).toBeNull();

    expect(mapPowensTransaction(transaction({ value: null }), "EUR", 2)).toBe(
      null
    );

    expect(mapPowensTransaction(transaction({ date: null }), "EUR", 2)).toBe(
      null
    );
  });
});

describe("mapPowensTransactions", () => {
  test("keeps only the bookable rows", () => {
    const mapped = mapPowensTransactions(
      [
        transaction({ id: 1 }),
        transaction({ deleted: "2026-03-05 10:00:00", id: 2 }),
        transaction({ id: 3, value: null }),
        transaction({ id: 4 }),
      ],
      "EUR",
      2
    );

    expect(mapped.map((tx) => tx.providerTransactionId)).toEqual(["1", "4"]);
  });
});
