import { z } from "zod";

import { lastWorkingDayOfMonth } from "./public-holidays";

export interface BudgetMonth {
  month: number;
  year: number;
}

export interface BudgetMonthRange {
  from: Date;
  to: Date;
}

export const BUDGET_MONTH_ANCHORS = [
  "DAY_OF_MONTH",
  "LAST_DAY",
  "LAST_WORKING_DAY",
] as const;

export type BudgetMonthAnchor = (typeof BUDGET_MONTH_ANCHORS)[number];

export type BudgetMonthRule =
  | { anchor: "DAY_OF_MONTH"; startDay: number }
  | { anchor: "LAST_DAY" }
  | { anchor: "LAST_WORKING_DAY"; country: string | null };

export interface BudgetMonthSetting {
  anchor: BudgetMonthAnchor;
  country: string | null;
  startDay: number;
}

export const DEFAULT_BUDGET_MONTH_START_DAY = 1;

export const MAX_BUDGET_MONTH_START_DAY = 28;

export const CALENDAR_BUDGET_MONTH: BudgetMonthRule = {
  anchor: "DAY_OF_MONTH",
  startDay: DEFAULT_BUDGET_MONTH_START_DAY,
};

export const budgetMonthStartDaySchema = z
  .number()
  .int()
  .min(DEFAULT_BUDGET_MONTH_START_DAY)
  .max(MAX_BUDGET_MONTH_START_DAY);

export const budgetMonthAnchorSchema = z.enum(BUDGET_MONTH_ANCHORS);

export const DEFAULT_BUDGET_MONTH_ANCHOR: BudgetMonthAnchor =
  "LAST_WORKING_DAY";

export const holidayCountrySchema = z
  .string()
  .regex(/^[A-Z]{2}$/u)
  .nullable();

export const budgetMonthSettingInput = z.object({
  anchor: budgetMonthAnchorSchema,
  country: holidayCountrySchema,
  startDay: budgetMonthStartDaySchema,
});

const LAST_START_DAY_INSIDE_ITS_MONTH = 15;

const MONTHS_IN_A_YEAR = 12;

const normalised = (year: number, month: number): BudgetMonth => {
  const absolute = year * MONTHS_IN_A_YEAR + month;

  return {
    month:
      ((absolute % MONTHS_IN_A_YEAR) + MONTHS_IN_A_YEAR) % MONTHS_IN_A_YEAR,
    year: Math.floor(absolute / MONTHS_IN_A_YEAR),
  };
};

export const budgetMonthRuleOf = ({
  anchor,
  country,
  startDay,
}: BudgetMonthSetting): BudgetMonthRule => {
  if (anchor === "LAST_DAY") {
    return { anchor };
  }

  if (anchor === "LAST_WORKING_DAY") {
    return { anchor, country };
  }

  return { anchor, startDay };
};

export const shiftBudgetMonth = (
  { month, year }: BudgetMonth,
  months: number
): BudgetMonth => normalised(year, month + months);

export const budgetMonthStart = (
  { month, year }: BudgetMonth,
  rule: BudgetMonthRule
): Date => {
  if (rule.anchor === "LAST_DAY") {
    return new Date(Date.UTC(year, month, 0));
  }

  if (rule.anchor === "LAST_WORKING_DAY") {
    const previous = normalised(year, month - 1);

    return lastWorkingDayOfMonth(previous.year, previous.month, rule.country);
  }

  const startMonth =
    rule.startDay > LAST_START_DAY_INSIDE_ITS_MONTH ? month - 1 : month;

  return new Date(Date.UTC(year, startMonth, rule.startDay));
};

export const budgetMonthRange = (
  month: BudgetMonth,
  rule: BudgetMonthRule
): BudgetMonthRange => ({
  from: budgetMonthStart(month, rule),
  to: new Date(
    budgetMonthStart(shiftBudgetMonth(month, 1), rule).getTime() - 1
  ),
});

export const budgetMonthsRange = (
  last: BudgetMonth,
  count: number,
  rule: BudgetMonthRule
): BudgetMonthRange => ({
  from: budgetMonthRange(shiftBudgetMonth(last, 1 - count), rule).from,
  to: budgetMonthRange(last, rule).to,
});

export const budgetMonthOfDay = (
  day: { date: number; month: number; year: number },
  rule: BudgetMonthRule
): BudgetMonth => {
  const instant = Date.UTC(day.year, day.month, day.date);
  const calendar = normalised(day.year, day.month);
  const next = shiftBudgetMonth(calendar, 1);

  if (instant >= budgetMonthStart(next, rule).getTime()) {
    return next;
  }

  return instant >= budgetMonthStart(calendar, rule).getTime()
    ? calendar
    : shiftBudgetMonth(calendar, -1);
};

export const budgetMonthOfBankDate = (
  date: Date,
  rule: BudgetMonthRule
): BudgetMonth =>
  budgetMonthOfDay(
    {
      date: date.getUTCDate(),
      month: date.getUTCMonth(),
      year: date.getUTCFullYear(),
    },
    rule
  );

export const budgetMonthKey = ({ month, year }: BudgetMonth): string =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

export const budgetMonthKeysBetween = (
  from: Date,
  to: Date,
  rule: BudgetMonthRule
): string[] => {
  const keys: string[] = [];
  const last = budgetMonthOfBankDate(to, rule);
  let cursor = budgetMonthOfBankDate(from, rule);

  while (
    cursor.year < last.year ||
    (cursor.year === last.year && cursor.month <= last.month)
  ) {
    keys.push(budgetMonthKey(cursor));
    cursor = shiftBudgetMonth(cursor, 1);
  }

  return keys;
};

export const isCalendarBudgetMonth = (rule: BudgetMonthRule): boolean =>
  rule.anchor === "DAY_OF_MONTH" &&
  rule.startDay === DEFAULT_BUDGET_MONTH_START_DAY;
