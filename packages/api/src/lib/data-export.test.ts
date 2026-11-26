import { describe, expect, it } from "bun:test";

import { exportHolding, exportTransaction } from "./data-export";
import type { StoredTransaction } from "./data-export";

const storedTransaction = (
  overrides: Partial<StoredTransaction>
): StoredTransaction => ({
  amount: -1250,
  balanceAfterTransaction: 152_300,
  bankTransactionCode: null,
  bankTransactionFamilyCode: null,
  bankTransactionSubCode: null,
  category: null,
  categoryOverride: false,
  channel: "card",
  counterpartyName: "MONOPRIX",
  createdAt: new Date("2026-03-02T08:00:00.000Z"),
  creditorAccountIban: null,
  creditorAgentBic: null,
  creditorCountry: null,
  creditorIdentifications: null,
  creditorTown: null,
  currency: "EUR",
  date: new Date("2026-03-01T00:00:00.000Z"),
  debtorAccountIban: null,
  description: "CB MONOPRIX",
  exchangeFeeMinor: null,
  exchangeRate: null,
  id: "row-1",
  intermediaryName: null,
  isInternalTransfer: false,
  merchantCategoryCode: "5411",
  merchantKey: "MONOPRIX",
  normalisedDescriptor: "MONOPRIX",
  originalAmount: null,
  originalCurrency: null,
  providerTransactionId: "provider-1",
  psuNote: "groceries",
  referenceNumber: null,
  referenceNumberScheme: null,
  remittanceLines: ["CB MONOPRIX"],
  resolutionConfidence: 0.9,
  resolutionStage: "dictionary",
  resolvedCategory: "groceries",
  status: "BOOK",
  transactionDate: null,
  transactionPath: "card",
  valueDate: new Date("2026-03-02T00:00:00.000Z"),
  ...overrides,
});

describe("exportTransaction", () => {
  it("keeps every stored field and writes instants as ISO text", () => {
    expect(exportTransaction(storedTransaction({}))).toMatchObject({
      amount: -1250,
      createdAt: "2026-03-02T08:00:00.000Z",
      date: "2026-03-01T00:00:00.000Z",
      psuNote: "groceries",
      remittanceLines: ["CB MONOPRIX"],
      resolvedCategory: "groceries",
      transactionDate: null,
      valueDate: "2026-03-02T00:00:00.000Z",
    });
  });

  it("keeps creditor identifications of the stored shape only", () => {
    const identifications = [
      { identification: "FR12ZZZ123456", schemeName: "SEPA" },
    ];

    expect(
      exportTransaction(
        storedTransaction({ creditorIdentifications: identifications })
      ).creditorIdentifications
    ).toEqual(identifications);

    expect(
      exportTransaction(storedTransaction({ creditorIdentifications: "x" }))
        .creditorIdentifications
    ).toBeNull();
  });
});

describe("exportHolding", () => {
  it("writes decimals as text", () => {
    expect(
      exportHolding({
        code: "LU1681043599",
        codeType: "ISIN",
        currency: "EUR",
        label: "Amundi MSCI World UCITS ETF",
        providerHoldingId: "holding-1",
        quantity: { toString: () => "12.50000000" },
        unitCost: null,
        unitValue: { toString: () => "520.120000" },
        unrealisedGainMinor: 1200,
        valuationMinor: 650_150,
        valuedAt: new Date("2026-03-05T00:00:00.000Z"),
      })
    ).toEqual({
      code: "LU1681043599",
      codeType: "ISIN",
      currency: "EUR",
      label: "Amundi MSCI World UCITS ETF",
      providerHoldingId: "holding-1",
      quantity: "12.50000000",
      unitCost: null,
      unitValue: "520.120000",
      unrealisedGainMinor: 1200,
      valuationMinor: 650_150,
      valuedAt: "2026-03-05T00:00:00.000Z",
    });
  });
});
