import {
  budgetMonthOfDay,
  budgetMonthRange,
  budgetMonthsRange,
  shiftBudgetMonth,
} from "@freenary/api/lib/budget-month";
import type {
  BudgetMonth,
  BudgetMonthRule,
} from "@freenary/api/lib/budget-month";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import { reportingTotalOf, upcomingPayments } from "@/entities/recurring";
import type { RecurringData, UpcomingPayment } from "@/entities/recurring";
import { dayDelta } from "@/shared/lib/calendar-day";

export interface MonthRange {
  from: Date;
  to: Date;
}

export interface PacePoint {
  currentMinor: number;
  day: number;
  previousMinor: number;
}

export interface SpendingPace {
  currentToDateMinor: number;
  monthTotalMinor: number;
  points: PacePoint[];
  previousMonthTotalMinor: number;
  previousToDateMinor: number;
}

export interface AvailableToSpend {
  availableMinor: number;
  balanceMinor: number;
  billCount: number;
  billsMinor: number;
  monthEnd: Date;
  unconvertedBillCount: number;
}

export interface CategoryShare {
  amountMinor: number;
  category: SpendingCategory;
  share: number;
}

interface CashFlowPeriod {
  label: string;
  outgoing: number;
}

export interface CashFlow {
  currency: string;
  periods: (CashFlowPeriod & { incoming: number })[];
  unconvertedCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_LABEL_LENGTH = 10;

const UNSORTED: SpendingCategory = "uncategorised";

export const UPCOMING_ROWS_SHOWN = 5;

const budgetMonthOfToday = (today: Date, rule: BudgetMonthRule): BudgetMonth =>
  budgetMonthOfDay(
    {
      date: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
    },
    rule
  );

const daysIn = ({ from, to }: MonthRange): number =>
  Math.round((to.getTime() + 1 - from.getTime()) / MS_PER_DAY);

const utcDayOf = (today: Date): number =>
  Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

const localLastDayOf = ({ to }: MonthRange): Date =>
  new Date(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

export const dashboardMonths = (today: Date, rule: BudgetMonthRule) => {
  const current = budgetMonthOfToday(today, rule);

  return {
    current: budgetMonthRange(current, rule),
    previous: budgetMonthRange(shiftBudgetMonth(current, -1), rule),
  };
};

const runningTotals = (
  periods: CashFlowPeriod[],
  range: MonthRange
): number[] => {
  const days = daysIn(range);
  const byDay = Array.from({ length: days }, () => 0);

  for (const period of periods) {
    const index = Math.round(
      (new Date(period.label.slice(0, DAY_LABEL_LENGTH)).getTime() -
        range.from.getTime()) /
        MS_PER_DAY
    );

    if (index >= 0 && index < days) {
      byDay[index] = (byDay[index] ?? 0) + period.outgoing;
    }
  }

  let total = 0;

  return byDay.map((amount) => {
    total += amount;

    return total;
  });
};

export const spendingPace = (
  current: CashFlowPeriod[],
  previous: CashFlowPeriod[],
  today: Date,
  rule: BudgetMonthRule
): SpendingPace => {
  const months = dashboardMonths(today, rule);
  const previousDays = daysIn(months.previous);
  const currentTotals = runningTotals(current, months.current);
  const previousTotals = runningTotals(previous, months.previous);
  const dayOfMonth =
    Math.round((utcDayOf(today) - months.current.from.getTime()) / MS_PER_DAY) +
    1;

  const previousAt = (day: number) =>
    previousTotals[Math.min(day, previousDays) - 1] ?? 0;

  const points = Array.from({ length: dayOfMonth }, (_, index) => ({
    currentMinor: currentTotals[index] ?? 0,
    day: index + 1,
    previousMinor: previousAt(index + 1),
  }));

  return {
    currentToDateMinor: currentTotals[dayOfMonth - 1] ?? 0,
    monthTotalMinor: currentTotals.at(-1) ?? 0,
    points,
    previousMonthTotalMinor: previousTotals.at(-1) ?? 0,
    previousToDateMinor: previousAt(dayOfMonth),
  };
};

export const commitmentsDue = (
  recurring: RecurringData,
  today: Date,
  horizonDays: number
): UpcomingPayment[] =>
  upcomingPayments(
    recurring.items.filter((item) => item.kind === "fixed"),
    today,
    horizonDays
  );

export const availableToSpend = (
  recurring: RecurringData,
  today: Date,
  rule: BudgetMonthRule
): AvailableToSpend | null => {
  const balanceMinor = recurring.availableBalanceMinor;

  if (balanceMinor === null) {
    return null;
  }

  const monthEnd = localLastDayOf(dashboardMonths(today, rule).current);
  const bills = reportingTotalOf(
    commitmentsDue(recurring, today, dayDelta(today, monthEnd))
  );

  return {
    availableMinor: balanceMinor - bills.totalMinor,
    balanceMinor,
    billCount: bills.includedCount,
    billsMinor: bills.totalMinor,
    monthEnd,
    unconvertedBillCount: bills.unconvertedCount,
  };
};

export const topCategories = (
  categories: { amount: number; category: SpendingCategory }[],
  count: number
): CategoryShare[] => {
  const total = categories.reduce((sum, category) => sum + category.amount, 0);

  if (total <= 0) {
    return [];
  }

  return categories
    .filter((category) => category.amount > 0 && category.category !== UNSORTED)
    .toSorted((a, b) => b.amount - a.amount)
    .slice(0, count)
    .map((category) => ({
      amountMinor: category.amount,
      category: category.category,
      share: category.amount / total,
    }));
};

export const unsortedSpendMinor = (
  categories: { amount: number; category: SpendingCategory }[]
): number =>
  categories
    .filter((category) => category.category === UNSORTED)
    .reduce((total, category) => total + Math.max(category.amount, 0), 0);

export interface SpendingWeekInput {
  categories: { amountMinor: number; category: SpendingCategory }[];
  start: string;
  totalMinor: number;
}

export interface StackedWeek {
  amounts: Partial<Record<SpendingCategory, number>>;
  otherMinor: number;
  start: string;
  totalMinor: number;
}

export interface StackedWeeks {
  categories: SpendingCategory[];
  weeks: StackedWeek[];
}

export const STACKED_CATEGORIES_SHOWN = 4;

export const stackedWeeks = (
  weeks: SpendingWeekInput[],
  shown: number
): StackedWeeks => {
  const totals = new Map<SpendingCategory, number>();

  for (const week of weeks) {
    for (const { amountMinor, category } of week.categories) {
      if (category !== UNSORTED) {
        totals.set(category, (totals.get(category) ?? 0) + amountMinor);
      }
    }
  }

  const categories = [...totals.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, shown)
    .map(([category]) => category);

  const stacked = new Set(categories);

  return {
    categories,
    weeks: weeks.map((week) => {
      const amounts: Partial<Record<SpendingCategory, number>> = {};
      let otherMinor = 0;

      for (const { amountMinor, category } of week.categories) {
        if (stacked.has(category)) {
          amounts[category] = amountMinor;
        } else {
          otherMinor += amountMinor;
        }
      }

      return {
        amounts,
        otherMinor,
        start: week.start,
        totalMinor: week.totalMinor,
      };
    }),
  };
};

export const lastMonths = (
  today: Date,
  months: number,
  rule: BudgetMonthRule
): MonthRange =>
  budgetMonthsRange(budgetMonthOfToday(today, rule), months, rule);

export const daysLeftInMonth = (today: Date, rule: BudgetMonthRule): number =>
  dayDelta(today, localLastDayOf(dashboardMonths(today, rule).current));

export interface BudgetLine {
  actual: number;
  category: SpendingCategory;
  planned: number;
}

export const plannedLines = (lines: BudgetLine[]): BudgetLine[] =>
  lines.filter((line) => line.planned > 0);
