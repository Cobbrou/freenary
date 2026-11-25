import { describe, expect, it } from "bun:test";

import type { BudgetMonthRule } from "@freenary/api/lib/budget-month";

import type { RecurringData, RecurringItem } from "@/entities/recurring";

import {
  availableToSpend,
  dashboardMonths,
  daysLeftInMonth,
  lastMonths,
  spendingPace,
  stackedWeeks,
  topCategories,
  unsortedSpendMinor,
} from "./finance";

const CALENDAR_MONTH: BudgetMonthRule = { anchor: "DAY_OF_MONTH", startDay: 1 };

const PAYDAY: BudgetMonthRule = { anchor: "DAY_OF_MONTH", startDay: 28 };

const item = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  amountSpread: 0,
  category: "subscriptions",
  confidence: "confirmed",
  currency: "EUR",
  frequency: "monthly",
  intervalDays: 30,
  kind: "fixed",
  lastSeen: "2026-04-20T00:00:00.000Z",
  merchantKey: "netflix",
  merchantName: "Netflix",
  nextExpected: "2026-05-20T00:00:00.000Z",
  occurrences: 6,
  reportingAmountMinor: overrides.typicalAmountMinor ?? 1500,
  typicalAmountMinor: 1500,
  ...overrides,
});

const recurringData = (
  overrides: Partial<RecurringData> = {}
): RecurringData => ({
  asOf: "2026-05-12T10:00:00.000Z",
  availableBalanceMinor: 200_000,
  currency: "EUR",
  items: [],
  monthly: [],
  monthlyIncomeMinor: null,
  plannedOutgoingMinor: null,
  unconvertedBalanceCount: 0,
  unconvertedCount: 0,
  ...overrides,
});

describe("dashboardMonths", () => {
  it("spans whole UTC months, the way the budget page asks for them", () => {
    const { current, previous } = dashboardMonths(
      new Date(2026, 0, 15),
      CALENDAR_MONTH
    );

    expect(current.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(current.to.toISOString()).toBe("2026-01-31T23:59:59.999Z");
    expect(previous.from.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2025-12-31T23:59:59.999Z");
  });

  it("starts the current month on the payday once it has passed", () => {
    const { current, previous } = dashboardMonths(
      new Date(2026, 0, 29),
      PAYDAY
    );

    expect(current.from.toISOString()).toBe("2026-01-28T00:00:00.000Z");
    expect(current.to.toISOString()).toBe("2026-02-27T23:59:59.999Z");
    expect(previous.from.toISOString()).toBe("2025-12-28T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-01-27T23:59:59.999Z");
  });
});

describe("spendingPace", () => {
  it("compares this month with the same day of last month", () => {
    const pace = spendingPace(
      [
        { label: "2026-05-01", outgoing: 1000 },
        { label: "2026-05-03", outgoing: 500 },
      ],
      [
        { label: "2026-04-02", outgoing: 2000 },
        { label: "2026-04-28", outgoing: 9000 },
      ],
      new Date(2026, 4, 3),
      CALENDAR_MONTH
    );

    expect(pace.points).toEqual([
      { currentMinor: 1000, day: 1, previousMinor: 0 },
      { currentMinor: 1000, day: 2, previousMinor: 2000 },
      { currentMinor: 1500, day: 3, previousMinor: 2000 },
    ]);

    expect(pace.currentToDateMinor).toBe(1500);
    expect(pace.previousToDateMinor).toBe(2000);
    expect(pace.previousMonthTotalMinor).toBe(11_000);
    expect(pace.monthTotalMinor).toBe(1500);
  });

  it("holds last month at its final day when this month runs longer", () => {
    const pace = spendingPace(
      [],
      [{ label: "2026-02-28", outgoing: 700 }],
      new Date(2026, 2, 31),
      CALENDAR_MONTH
    );

    expect(pace.previousToDateMinor).toBe(700);
    expect(pace.points).toHaveLength(31);
  });

  it("counts the days from the start of the budget month", () => {
    const pace = spendingPace(
      [
        { label: "2026-04-28", outgoing: 1000 },
        { label: "2026-05-01", outgoing: 500 },
      ],
      [{ label: "2026-03-30", outgoing: 2000 }],
      new Date(2026, 4, 1),
      PAYDAY
    );

    expect(pace.points).toHaveLength(4);
    expect(pace.currentToDateMinor).toBe(1500);
    expect(pace.previousToDateMinor).toBe(2000);
  });
});

describe("availableToSpend", () => {
  const today = new Date(2026, 4, 12);

  it("takes the commitments still due this month off the balance", () => {
    const available = availableToSpend(
      recurringData({
        items: [
          item(),
          item({
            merchantKey: "rent",
            nextExpected: "2026-06-01T00:00:00.000Z",
            typicalAmountMinor: 80_000,
          }),
          item({
            kind: "behavioral",
            merchantKey: "groceries",
            nextExpected: "2026-05-14T00:00:00.000Z",
          }),
        ],
      }),
      today,
      CALENDAR_MONTH
    );

    expect(available).toEqual({
      availableMinor: 198_500,
      balanceMinor: 200_000,
      billCount: 1,
      billsMinor: 1500,
      monthEnd: new Date(2026, 4, 31),
      unconvertedBillCount: 0,
    });
  });

  it("takes a commitment in another currency off at its converted amount", () => {
    const available = availableToSpend(
      recurringData({
        items: [item({ currency: "USD", reportingAmountMinor: 1300 })],
      }),
      today,
      CALENDAR_MONTH
    );

    expect(available?.billsMinor).toBe(1300);
    expect(available?.billCount).toBe(1);
  });

  it("leaves out and counts a commitment with no exchange rate", () => {
    const available = availableToSpend(
      recurringData({
        items: [item({ currency: "XYZ", reportingAmountMinor: null })],
      }),
      today,
      CALENDAR_MONTH
    );

    expect(available?.billsMinor).toBe(0);
    expect(available?.unconvertedBillCount).toBe(1);
  });

  it("has nothing to say without a current-account balance", () => {
    expect(
      availableToSpend(
        recurringData({ availableBalanceMinor: null }),
        today,
        CALENDAR_MONTH
      )
    ).toBeNull();
  });
});

describe("topCategories", () => {
  it("leaves unsorted spending out of the ranking but in the shares", () => {
    expect(
      topCategories(
        [
          { amount: 3000, category: "uncategorised" },
          { amount: 1000, category: "groceries" },
        ],
        2
      )
    ).toEqual([{ amountMinor: 1000, category: "groceries", share: 0.25 }]);
  });

  it("ranks the largest categories with their share of all spending", () => {
    expect(
      topCategories(
        [
          { amount: 1000, category: "groceries" },
          { amount: 3000, category: "rent-mortgage" },
          { amount: 1000, category: "car-fuel" },
        ],
        2
      )
    ).toEqual([
      { amountMinor: 3000, category: "rent-mortgage", share: 0.6 },
      { amountMinor: 1000, category: "groceries", share: 0.2 },
    ]);
  });

  it("is empty when nothing was spent", () => {
    expect(topCategories([], 4)).toEqual([]);
  });
});

describe("unsortedSpendMinor", () => {
  it("adds up what no category claims yet", () => {
    expect(
      unsortedSpendMinor([
        { amount: 3000, category: "uncategorised" },
        { amount: 1000, category: "groceries" },
      ])
    ).toBe(3000);
  });

  it("is zero when every payment has a category", () => {
    expect(unsortedSpendMinor([{ amount: 1000, category: "groceries" }])).toBe(
      0
    );
  });
});

describe("stackedWeeks", () => {
  it("stacks the largest categories of the whole range and folds the rest", () => {
    const stacked = stackedWeeks(
      [
        {
          categories: [
            { amountMinor: 5000, category: "groceries" },
            { amountMinor: 900, category: "health" },
            { amountMinor: 300, category: "uncategorised" },
          ],
          start: "2026-11-09",
          totalMinor: 6200,
        },
        {
          categories: [{ amountMinor: 4000, category: "restaurants" }],
          start: "2026-11-16",
          totalMinor: 4000,
        },
      ],
      2
    );

    expect(stacked.categories).toEqual(["groceries", "restaurants"]);
    expect(stacked.weeks).toEqual([
      {
        amounts: { groceries: 5000 },
        otherMinor: 1200,
        start: "2026-11-09",
        totalMinor: 6200,
      },
      {
        amounts: { restaurants: 4000 },
        otherMinor: 0,
        start: "2026-11-16",
        totalMinor: 4000,
      },
    ]);
  });
});

describe("lastMonths", () => {
  it("spans from the first day of the earliest month to the end of this one", () => {
    const range = lastMonths(new Date(2026, 10, 18), 3, CALENDAR_MONTH);

    expect(range.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-11-30T23:59:59.999Z");
  });
});

describe("daysLeftInMonth", () => {
  it("counts the days after today until the month ends", () => {
    expect(daysLeftInMonth(new Date(2026, 10, 17), CALENDAR_MONTH)).toBe(13);
    expect(daysLeftInMonth(new Date(2026, 1, 28), CALENDAR_MONTH)).toBe(0);
  });

  it("counts until the day before the next payday", () => {
    expect(daysLeftInMonth(new Date(2026, 10, 28), PAYDAY)).toBe(29);
    expect(daysLeftInMonth(new Date(2026, 10, 27), PAYDAY)).toBe(0);
  });
});

describe("dashboardMonths on the last working day", () => {
  it("starts the month on the Friday before a month-end weekend", () => {
    const { current } = dashboardMonths(new Date(2026, 4, 29), {
      anchor: "LAST_WORKING_DAY",
      country: "FR",
    });

    expect(current.from.toISOString()).toBe("2026-05-29T00:00:00.000Z");
    expect(current.to.toISOString()).toBe("2026-06-29T23:59:59.999Z");
  });
});
