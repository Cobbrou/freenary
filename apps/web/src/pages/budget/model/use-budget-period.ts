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

const startOfMonth = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);

export const useBudgetPeriod = ({
  aggregation = BUDGET_SEARCH_DEFAULTS.agg,
  dateBounds,
  month,
  onChange,
  range = BUDGET_SEARCH_DEFAULTS.range,
  year,
}: {
  aggregation?: AggregationMode;
  dateBounds?: { first: Date | null; last: Date | null };
  month?: number;
  onChange: (patch: BudgetPeriodPatch) => void;
  range?: TimeRange;
  year?: number;
}) => {
  const lastDataDate = dateBounds?.last;
  const lastMonth = useMemo(
    () => (lastDataDate ? startOfMonth(lastDataDate) : undefined),
    [lastDataDate]
  );

  const anchor = useMemo(() => {
    const fallback = lastMonth ?? new Date();

    return {
      month: month ?? fallback.getMonth(),
      year: year ?? fallback.getFullYear(),
    };
  }, [lastMonth, month, year]);

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
        patch.range ?? range
      ),
    }),
    [aggregation, anchor, range]
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
    () => computeDateRange(anchor.year, anchor.month, range),
    [anchor, range]
  );

  return {
    aggregation,
    firstMonth: dateBounds?.first ? startOfMonth(dateBounds.first) : undefined,
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
