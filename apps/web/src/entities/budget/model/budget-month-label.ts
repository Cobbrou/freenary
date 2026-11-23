import { budgetMonthRange } from "@freenary/api/lib/budget-month";
import type {
  BudgetMonth,
  BudgetMonthRange,
  BudgetMonthRule,
} from "@freenary/api/lib/budget-month";

const SPAN_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
};

const RANGE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
};

const MONTH_FORMAT: Intl.DateTimeFormatOptions = {
  month: "long",
  timeZone: "UTC",
};

export const formatBudgetMonthSpan = (
  { from, to }: BudgetMonthRange,
  locale: string
): string =>
  new Intl.DateTimeFormat(locale, RANGE_FORMAT).formatRange(from, to);

export const budgetMonthExample = (
  month: BudgetMonth,
  rule: BudgetMonthRule,
  locale: string
) => {
  const range = budgetMonthRange(month, rule);
  const format = (date: Date) => date.toLocaleDateString(locale, SPAN_FORMAT);

  return {
    from: format(range.from),
    month: new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString(
      locale,
      MONTH_FORMAT
    ),
    to: format(range.to),
  };
};
