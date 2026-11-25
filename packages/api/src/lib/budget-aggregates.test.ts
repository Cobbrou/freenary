import { describe, expect, it } from "bun:test";

import { cashFlowAccountsOf } from "./account-types";
import {
  cashFlowPeriodsOf,
  countedTransactionsWhere,
  sankeyOf,
  statRowOf,
} from "./budget-aggregates";

const MAY_FIFTH = new Date("2026-05-05T10:00:00.000Z");

const storedRow = (
  overrides: Partial<Parameters<typeof statRowOf>[0]>
): Parameters<typeof statRowOf>[0] => ({
  amount: -10_000,
  category: null,
  counterpartyName: "Wise",
  currency: "EUR",
  date: MAY_FIFTH,
  exchangeFeeMinor: null,
  isInternalTransfer: false,
  merchantKey: "wise",
  originalAmount: null,
  originalCurrency: null,
  resolvedCategory: "shopping",
  ...overrides,
});

describe("countedTransactionsWhere", () => {
  it("keeps every currency and leaves internal transfers out unless they moved money into savings or cost an exchange fee", () => {
    const from = new Date("2026-10-01T00:00:00.000Z");
    const to = new Date("2026-10-31T23:59:59.999Z");

    expect(countedTransactionsWhere("user", from, to)).toEqual({
      OR: [
        { isInternalTransfer: false },
        { resolvedCategory: { in: ["retirement", "savings", "securities"] } },
        { exchangeFeeMinor: { gt: 0 } },
      ],
      account: cashFlowAccountsOf("user"),
      date: { gte: from, lte: to },
    });
  });
});

describe("statRowOf", () => {
  it("leaves an ordinary transaction untouched", () => {
    const row = storedRow({});

    expect(statRowOf(row)).toEqual(row);
  });

  it("keeps a transfer into savings whole", () => {
    const row = storedRow({
      exchangeFeeMinor: 120,
      isInternalTransfer: true,
      resolvedCategory: "savings",
    });

    expect(statRowOf(row)).toEqual(row);
  });

  it("turns an exchange between currencies into the fee it cost", () => {
    expect(
      statRowOf(
        storedRow({
          amount: -100_000,
          currency: "EUR",
          exchangeFeeMinor: 350,
          isInternalTransfer: true,
          originalAmount: 108_000,
          originalCurrency: "USD",
          resolvedCategory: "internal-transfer",
        })
      )
    ).toEqual({
      amount: -350,
      category: "loans-bank-fees",
      counterpartyName: null,
      currency: "EUR",
      date: MAY_FIFTH,
      exchangeFeeMinor: 350,
      isInternalTransfer: true,
      merchantKey: null,
      originalAmount: null,
      originalCurrency: null,
      resolvedCategory: "loans-bank-fees",
    });
  });
});

describe("cashFlowPeriodsOf", () => {
  const rows = [
    { amount: -2000, date: new Date("2026-05-06T09:00:00.000Z") },
    { amount: 50_000, date: new Date("2026-05-04T09:00:00.000Z") },
    { amount: -3000, date: new Date("2026-05-04T18:00:00.000Z") },
    { amount: -1000, date: new Date("2026-05-11T09:00:00.000Z") },
  ];

  it("splits each day into incoming and outgoing, oldest first", () => {
    expect(cashFlowPeriodsOf(rows, "day")).toEqual([
      { incoming: 50_000, label: "2026-05-04", outgoing: 3000 },
      { incoming: 0, label: "2026-05-06", outgoing: 2000 },
      { incoming: 0, label: "2026-05-11", outgoing: 1000 },
    ]);
  });

  it("labels each week by its Monday", () => {
    expect(cashFlowPeriodsOf(rows, "week")).toEqual([
      { incoming: 50_000, label: "2026-05-04", outgoing: 5000 },
      { incoming: 0, label: "2026-05-11", outgoing: 1000 },
    ]);
  });

  it("files a Sunday under the Monday before it", () => {
    expect(
      cashFlowPeriodsOf(
        [{ amount: -500, date: new Date("2026-05-10T23:00:00.000Z") }],
        "week"
      )
    ).toEqual([{ incoming: 0, label: "2026-05-04", outgoing: 500 }]);
  });
});

describe("sankeyOf", () => {
  it("averages the expenses over a month that only has income too", () => {
    const sankey = sankeyOf(
      [
        {
          amount: 300_000,
          category: null,
          counterpartyName: "Employer",
          date: new Date("2026-01-10T00:00:00.000Z"),
          merchantKey: null,
          resolvedCategory: null,
        },
        {
          amount: -10_000,
          category: "groceries",
          counterpartyName: "Shop",
          date: new Date("2026-02-10T00:00:00.000Z"),
          merchantKey: null,
          resolvedCategory: null,
        },
      ],
      {
        aggregation: "average",
        from: new Date("2026-01-01T00:00:00.000Z"),
        rule: { anchor: "DAY_OF_MONTH", startDay: 1 },
        to: new Date("2026-03-31T23:59:59.999Z"),
      }
    );

    expect(sankey.incomeNodes).toEqual([{ name: "Employer", value: 150_000 }]);
    expect(sankey.totalExpenses).toBe(5000);
    expect(sankey.moneyLeft).toBe(145_000);
  });
});
