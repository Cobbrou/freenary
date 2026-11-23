import type { AggregationMode } from "@freenary/api/lib/aggregation";
import {
  budgetMonthsRange,
  shiftBudgetMonth,
} from "@freenary/api/lib/budget-month";
import type {
  BudgetMonth,
  BudgetMonthRule,
} from "@freenary/api/lib/budget-month";

import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export type TimeRange = "1M" | "3M" | "1Y";

export { AGGREGATION_MODES } from "@freenary/api/lib/aggregation";
export type { AggregationMode } from "@freenary/api/lib/aggregation";

const AGGREGATION_LABEL_MESSAGES = {
  average: m.budget_aggregation_average,
  median: m.budget_aggregation_median,
  total: m.budget_aggregation_total,
} satisfies Record<AggregationMode, () => string>;

const MONTHS_IN_RANGE = {
  "1M": 1,
  "1Y": 12,
  "3M": 3,
} satisfies Record<TimeRange, number>;

const SHORT_MONTH: Intl.DateTimeFormatOptions = {
  month: "short",
  timeZone: "UTC",
};

export const TIME_RANGES: TimeRange[] = ["1M", "3M", "1Y"];

export const aggregationLabel = (mode: AggregationMode): string =>
  AGGREGATION_LABEL_MESSAGES[mode]();

export const isMultiMonth = (range: TimeRange) => range !== "1M";

export const rangeMonths = (range: TimeRange): number => MONTHS_IN_RANGE[range];

export const formatMonthYear = (date: Date, locale: Locale): string =>
  date.toLocaleDateString(locale, {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });

const formatShortMonthSpan = (from: Date, to: Date, locale: Locale): string => {
  const fromMonth = from.toLocaleDateString(locale, SHORT_MONTH);
  const toMonth = to.toLocaleDateString(locale, SHORT_MONTH);
  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  return fromYear === toYear
    ? `${fromMonth} – ${toMonth} ${toYear}`
    : `${fromMonth} ${fromYear} – ${toMonth} ${toYear}`;
};

const firstDayOf = ({ month, year }: BudgetMonth): Date =>
  new Date(Date.UTC(year, month, 1));

export const formatPeriodLabel = (
  anchor: BudgetMonth,
  range: TimeRange,
  locale: Locale
): string => {
  if (range === "1M") {
    return formatMonthYear(firstDayOf(anchor), locale);
  }

  if (range === "1Y") {
    return String(anchor.year);
  }

  return formatShortMonthSpan(
    firstDayOf(shiftBudgetMonth(anchor, 1 - rangeMonths(range))),
    firstDayOf(anchor),
    locale
  );
};

export const computeDateRange = (
  year: number,
  month: number,
  range: TimeRange,
  rule: BudgetMonthRule
) => budgetMonthsRange({ month, year }, rangeMonths(range), rule);
