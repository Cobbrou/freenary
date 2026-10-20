import { describe, expect, it } from "bun:test";

import {
  generateAccounts,
  generateHoldings,
  generateTransactions,
  planAccounts,
} from "./generate";

const SESSION = "mock_2026-03-01_0f8b6c1e-2d4a-4b7e-9c3f-5a6b7c8d9e0f";
const OTHER_SESSION = "mock_2026-03-01_7e1d2c3b-4a59-4687-b9a1-0c2d3e4f5a6b";
const CHECKING = `${SESSION}:checking`;
const TODAY = new Date("2026-03-31T10:00:00Z");
const NEXT_MONTH = new Date("2026-04-30T10:00:00Z");

const idsOf = (transactions: { providerTransactionId: string }[]) =>
  transactions.map((transaction) => transaction.providerTransactionId);

describe("mock bank data", () => {
  it("returns the same transactions for the same account and window", () => {
    expect(
      generateTransactions(CHECKING, "2026-01-01", "2026-03-31", TODAY)
    ).toEqual(
      generateTransactions(CHECKING, "2026-01-01", "2026-03-31", TODAY)
    );
  });

  it("keeps a day's transactions when the sync window moves", () => {
    const wide = generateTransactions(
      CHECKING,
      "2026-01-01",
      "2026-03-31",
      TODAY
    );

    const narrow = generateTransactions(
      CHECKING,
      "2026-03-01",
      "2026-03-31",
      TODAY
    );

    const marchOfWide = wide.filter(
      (transaction) => transaction.bookingDate >= "2026-03-01"
    );

    expect(idsOf(narrow)).toEqual(idsOf(marchOfWide));
  });

  it("gives another connection other accounts and descriptors", () => {
    const first = planAccounts(SESSION);
    const second = planAccounts(OTHER_SESSION);

    expect(first.map((account) => account.iban)).not.toEqual(
      second.map((account) => account.iban)
    );
  });

  it("pays a salary once a month and books French descriptors", () => {
    const quarter = generateTransactions(
      CHECKING,
      "2026-01-01",
      "2026-03-31",
      TODAY
    );

    const salaries = quarter.filter((transaction) =>
      transaction.remittanceLines[0]?.includes("SALAIRE")
    );

    expect(salaries).toHaveLength(3);
    expect(salaries.every((salary) => salary.amountMinor > 0)).toBe(true);
    expect(
      quarter.some((transaction) =>
        transaction.remittanceLines[0]?.startsWith("PRLV SEPA EDF")
      )
    ).toBe(true);
  });

  it("generates nothing after today", () => {
    const transactions = generateTransactions(
      CHECKING,
      "2026-03-25",
      "2026-04-30",
      TODAY
    );

    expect(
      transactions.every(
        (transaction) => transaction.bookingDate <= "2026-03-31"
      )
    ).toBe(true);
  });

  it("values holdings for investment accounts only", () => {
    const brokerage = generateAccounts(SESSION, TODAY).find(
      (account) => account.type === "BROKERAGE"
    );

    const holdings = generateHoldings(`${SESSION}:pea`, TODAY);
    const total = holdings.reduce(
      (sum, holding) => sum + holding.valuationMinor,
      0
    );

    expect(generateHoldings(CHECKING, TODAY)).toEqual([]);
    expect(holdings.length).toBeGreaterThan(0);
    expect(brokerage?.balanceMinor).toBe(total);
  });

  it("moves a balance only by the transactions booked in between", () => {
    const balanceOn = (day: Date) =>
      generateAccounts(SESSION, day).find(
        (account) => account.providerAccountId === CHECKING
      )?.balanceMinor ?? 0;

    const booked = generateTransactions(
      CHECKING,
      "2026-04-01",
      "2026-04-30",
      NEXT_MONTH
    ).reduce((total, transaction) => total + transaction.amountMinor, 0);

    expect(balanceOn(NEXT_MONTH) - balanceOn(TODAY)).toBe(booked);
  });
});
