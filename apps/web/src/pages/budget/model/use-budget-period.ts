import type { BudgetMonthRule } from "@freenary/api/lib/budget-month";
import {
  budgetMonthOfBankDate,
  budgetMonthOfDay,
} from "@freenary/api/lib/budget-month";
import { useCallback, useMemo } from "react";

import type { PeriodInput } from "../api/budget-queries";
import { computeDateRange, isMultiMonth } from "./period";
import type { AggregationMode, TimeRange } from "./period";
import { BUDGET_SEARCH_DEFAULTS } from "./search";

export interface BudgetPeriodPatch {
  aggregation?: AggregationMode;
  month?: number;
  range?: TimeRange;
  year?: number;
}

const CALENDAR_YEAR_END_MONTH = 11;

const budgetMonthStartOf = (date: Date, rule: BudgetMonthRule) => {
  const { month, year } = budgetMonthOfBankDate(date, rule);

  return new Date(year, month, 1);
};

const currentBudgetMonthStart = (rule: BudgetMonthRule) => {
  const today = new Date();
  const { month, year } = budgetMonthOfDay(
    {
      date: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
    },
    rule
  );

  return new Date(year, month, 1);
};

export const useBudgetPeriod = ({
  aggregation = BUDGET_SEARCH_DEFAULTS.agg,
  dateBounds,
  month,
  onChange,
  range = BUDGET_SEARCH_DEFAULTS.range,
  rule,
  year,
}: {
  aggregation?: AggregationMode;
  dateBounds?: { first: Date | null; last: Date | null };
  month?: number;
  onChange: (patch: BudgetPeriodPatch) => void;
  range?: TimeRange;
  rule: BudgetMonthRule;
  year?: number;
}) => {
  const lastDataDate = dateBounds?.last;
  const lastMonth = useMemo(
    () => (lastDataDate ? budgetMonthStartOf(lastDataDate, rule) : undefined),
    [lastDataDate, rule]
  );

  const anchor = useMemo(() => {
    const fallback = lastMonth ?? currentBudgetMonthStart(rule);

    return {
      month: month ?? fallback.getMonth(),
      year: year ?? fallback.getFullYear(),
    };
  }, [lastMonth, month, rule, year]);

  const rangePatch = useCallback(
    (next: TimeRange): BudgetPeriodPatch => {
      const patch: BudgetPeriodPatch = { range: next };

      if (!isMultiMonth(next)) {
        patch.aggregation = "total";
      }

      if (next === "1Y") {
        patch.month = CALENDAR_YEAR_END_MONTH;
        patch.year = anchor.year;
      } else if (lastMonth) {
        const lastMonthIndex = lastMonth.getMonth();
        const lastYear = lastMonth.getFullYear();
        const isAnchorBeyondData =
          anchor.year > lastYear ||
          (anchor.year === lastYear && anchor.month > lastMonthIndex);

        if (isAnchorBeyondData) {
          patch.month = lastMonthIndex;
          patch.year = lastYear;
        }
      }

      return patch;
    },
    [anchor, lastMonth]
  );

  const changeRange = useCallback(
    (next: TimeRange) => onChange(rangePatch(next)),
    [onChange, rangePatch]
  );

  const periodForPatch = useCallback(
    (patch: BudgetPeriodPatch): PeriodInput => ({
      aggregation: patch.aggregation ?? aggregation,
      ...computeDateRange(
        patch.year ?? anchor.year,
        patch.month ?? anchor.month,
        patch.range ?? range,
        rule
      ),
    }),
    [aggregation, anchor, range, rule]
  );

  const setAggregation = useCallback(
    (next: AggregationMode) => onChange({ aggregation: next }),
    [onChange]
  );

  const setMonth = useCallback(
    (nextYear: number, nextMonth: number) =>
      onChange({ month: nextMonth, year: nextYear }),
    [onChange]
  );

  const { from, to } = useMemo(
    () => computeDateRange(anchor.year, anchor.month, range, rule),
    [anchor, range, rule]
  );

  return {
    aggregation,
    anchor,
    firstMonth: dateBounds?.first
      ? budgetMonthStartOf(dateBounds.first, rule)
      : undefined,
    from,
    lastMonth,
    previewMonth: (nextYear: number, nextMonth: number) =>
      periodForPatch({ month: nextMonth, year: nextYear }),
    previewRange: (next: TimeRange) => periodForPatch(rangePatch(next)),
    range,
    setAggregation,
    setMonth,
    setRange: changeRange,
    to,
  };
};
