import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export type TimeRange = "1M" | "3M" | "1Y";

export type AggregationMode = "total" | "average" | "median";

export const AGGREGATION_MODES: AggregationMode[] = [
  "total",
  "average",
  "median",
];

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

const DAY_BEFORE_THE_FIRST = 0;
const END_OF_DAY = { hours: 23, milliseconds: 999, minutes: 59, seconds: 59 };

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

export const formatPeriodLabel = (
  from: Date,
  to: Date,
  range: TimeRange,
  locale: Locale
): string => {
  if (range === "1M") {
    return formatMonthYear(from, locale);
  }

  if (range === "1Y") {
    return String(from.getUTCFullYear());
  }

  return formatShortMonthSpan(from, to, locale);
};

const endOfMonth = (year: number, month: number): Date =>
  new Date(
    Date.UTC(
      year,
      month + 1,
      DAY_BEFORE_THE_FIRST,
      END_OF_DAY.hours,
      END_OF_DAY.minutes,
      END_OF_DAY.seconds,
      END_OF_DAY.milliseconds
    )
  );

export const computeDateRange = (
  year: number,
  month: number,
  range: TimeRange
) => {
  const monthsBeforeAnchor = rangeMonths(range) - 1;

  return {
    from: new Date(Date.UTC(year, month - monthsBeforeAnchor, 1)),
    to: endOfMonth(year, month),
  };
};
