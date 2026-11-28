import { describe, expect, it } from "bun:test";

import { CALENDAR_BUDGET_MONTH } from "./budget-month";
import {
  categoriesOf,
  largestExpenseOf,
  monthlyOf,
  monthsBackToYearStart,
  pointsWithinYear,
  recurringYearOf,
  reviewOpenedAt,
  reviewYearOf,
  reviewYearRange,
  reviewYears,
  topMerchantsOf,
  yearFiguresOf,
} from "./year-review";
import type { YearRow } from "./year-review";

const row = (overrides: Partial<YearRow>): YearRow => ({
  amount: -1000,
  category: null,
  counterpartyName: null,
  date: new Date("2026-03-10T12:00:00.000Z"),
  merchantKey: null,
  resolvedCategory: "groceries",
  ...overrides,
});

describe("reviewYearOf", () => {
  it("opens on 15 December and closes after January", () => {
    expect(reviewYearOf(new Date("2026-12-14T23:59:59.000Z"))).toBeNull();
    expect(reviewYearOf(new Date("2026-12-15T00:00:00.000Z"))).toBe(2026);
    expect(reviewYearOf(new Date("2027-01-31T23:59:59.000Z"))).toBe(2026);
    expect(reviewYearOf(new Date("2027-02-01T00:00:00.000Z"))).toBeNull();
  });

  it("dates the opening of the review shown now", () => {
    const january = new Date("2027-01-10T00:00:00.000Z");
    const june = new Date("2026-06-01T00:00:00.000Z");

    expect(reviewOpenedAt(january)).toEqual(
      new Date("2026-12-15T00:00:00.000Z")
    );

    expect(reviewOpenedAt(june)).toEqual(june);
  });
});

describe("reviewYearRange", () => {
  it("spans the calendar year for calendar months", () => {
    expect(reviewYearRange(2026, CALENDAR_BUDGET_MONTH)).toEqual({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-12-31T23:59:59.999Z"),
    });
  });

  it("spans twelve budget months when they start late in the month", () => {
    expect(
      reviewYearRange(2026, { anchor: "DAY_OF_MONTH", startDay: 25 })
    ).toEqual({
      from: new Date("2025-12-25T00:00:00.000Z"),
      to: new Date("2026-12-24T23:59:59.999Z"),
    });
  });
});

describe("reviewYears", () => {
  it("lists the years from the featured one back to the first transaction", () => {
    expect(reviewYears(new Date("2024-06-01T00:00:00.000Z"), 2026)).toEqual([
      2026, 2025, 2024,
    ]);

    expect(reviewYears(null, 2026)).toEqual([]);
  });
});

describe("yearFiguresOf", () => {
  it("counts transfers to savings as saved, not spent", () => {
    const figures = yearFiguresOf(
      [
        row({ amount: 300_000, resolvedCategory: "salary" }),
        row({ amount: -100_000 }),
        row({ amount: -50_000, resolvedCategory: "savings" }),
        row({ amount: 10_000, date: new Date("2026-07-02T00:00:00.000Z") }),
      ],
      CALENDAR_BUDGET_MONTH
    );

    expect(figures).toEqual({
      expensesMinor: 150_000,
      incomeMinor: 310_000,
      monthsWithData: 2,
      netMinor: 160_000,
      paymentCount: 2,
      savedMinor: 50_000,
      savingsRate: 210_000 / 310_000,
    });
  });

  it("has no savings rate without income", () => {
    expect(
      yearFiguresOf([row({})], CALENDAR_BUDGET_MONTH).savingsRate
    ).toBeNull();
  });
});

describe("monthlyOf", () => {
  it("zero-fills the twelve months of the year", () => {
    const months = monthlyOf(
      [row({ amount: -2500 }), row({ amount: 4000 })],
      reviewYearRange(2026, CALENDAR_BUDGET_MONTH),
      CALENDAR_BUDGET_MONTH
    );

    expect(months).toHaveLength(12);
    expect(months[2]).toEqual({
      incomingMinor: 4000,
      month: "2026-03",
      outgoingMinor: 2500,
    });

    expect(months[0]).toEqual({
      incomingMinor: 0,
      month: "2026-01",
      outgoingMinor: 0,
    });
  });
});

describe("categoriesOf", () => {
  it("keeps categories of either year, largest first", () => {
    expect(
      categoriesOf(
        new Map([["groceries", 500]]),
        new Map([
          ["groceries", 400],
          ["shopping", 900],
        ])
      )
    ).toEqual([
      { amountMinor: 500, category: "groceries", previousAmountMinor: 400 },
      { amountMinor: 0, category: "shopping", previousAmountMinor: 900 },
    ]);
  });
});

describe("topMerchantsOf", () => {
  const rows = [
    row({ amount: -500, counterpartyName: "Corner Cafe", merchantKey: "cafe" }),
    row({
      amount: -500,
      counterpartyName: "CORNER CAFE",
      merchantKey: "cafe-terminal-2",
    }),
    row({ amount: -500, counterpartyName: "Corner Cafe", merchantKey: "cafe" }),
    row({ amount: -90_000, merchantKey: "airline" }),
    row({
      amount: -200_000,
      merchantKey: "livret",
      resolvedCategory: "savings",
    }),
    row({ amount: 5000, merchantKey: "refund" }),
    row({ amount: -700 }),
  ];

  it("ranks spending merchants by amount and by payments, without savings", () => {
    const { byAmount, byCount } = topMerchantsOf(rows);

    expect(byAmount.map((merchant) => merchant.merchantKey)).toEqual([
      "airline",
      "corner cafe",
    ]);

    expect(byCount[0]).toEqual({
      count: 3,
      merchantKey: "corner cafe",
      merchantName: "Corner Cafe",
      totalMinor: 1500,
    });
  });

  it("sums the year of recurring merchants only", () => {
    expect(recurringYearOf(rows, new Set(["cafe"]))).toEqual({
      items: [
        {
          count: 2,
          merchantKey: "corner cafe",
          merchantName: "Corner Cafe",
          totalMinor: 1000,
        },
      ],
      merchantCount: 1,
      totalMinor: 1000,
    });
  });
});

describe("largestExpenseOf", () => {
  it("finds the largest payment", () => {
    expect(
      largestExpenseOf([
        row({ amount: -100 }),
        row({
          amount: -9000,
          counterpartyName: "Garage",
          merchantKey: "garage",
        }),
        row({ amount: 50_000 }),
      ])
    ).toEqual({
      amountMinor: 9000,
      category: "groceries",
      date: "2026-03-10T12:00:00.000Z",
      merchantKey: "garage",
      merchantName: "Garage",
    });

    expect(largestExpenseOf([])).toBeNull();
  });
});

describe("net worth over the year", () => {
  it("rewinds to the end of the year before", () => {
    expect(
      monthsBackToYearStart(2026, new Date("2026-12-20T00:00:00.000Z"))
    ).toBe(12);

    expect(
      monthsBackToYearStart(2025, new Date("2027-01-05T00:00:00.000Z"))
    ).toBe(25);
  });

  it("drops the points after the year", () => {
    expect(
      pointsWithinYear(
        [
          { balanceMinor: 1, date: "2025-12-31" },
          { balanceMinor: 2, date: "2026-12-31" },
          { balanceMinor: 3, date: "2027-01-05" },
        ],
        2026
      )
    ).toEqual([
      { balanceMinor: 1, date: "2025-12-31" },
      { balanceMinor: 2, date: "2026-12-31" },
    ]);

    expect(pointsWithinYear(null, 2026)).toEqual([]);
  });
});
