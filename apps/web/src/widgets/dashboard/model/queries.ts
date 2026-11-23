import { CALENDAR_BUDGET_MONTH } from "@freenary/api/lib/budget-month";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { useQuery } from "@tanstack/react-query";

import { TRANSACTIONS_QUERY_KEY, useBudgetMonthRule } from "@/entities/budget";
import { client, orpc } from "@/shared/api";

import { dashboardMonths, lastMonths } from "./finance";
import { widgetQuery } from "./widget-query";
import type { WidgetQuery } from "./widget-query";

const END_OF_DAY = { hours: 23, milliseconds: 999, minutes: 59, seconds: 59 };

export const endOfDay = (today: Date): Date =>
  new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    END_OF_DAY.hours,
    END_OF_DAY.minutes,
    END_OF_DAY.seconds,
    END_OF_DAY.milliseconds
  );

export const useBudgetMonth = () => {
  const rule = useBudgetMonthRule();

  return {
    isKnown: rule !== undefined,
    rule: rule ?? CALENDAR_BUDGET_MONTH,
  };
};

export const untilBudgetMonthKnown = <T>(
  query: WidgetQuery<T>,
  isKnown: boolean
): WidgetQuery<T> =>
  isKnown ? query : { ...query, data: undefined, isPending: true };

export const useOverview = () =>
  widgetQuery(useQuery(orpc.portfolio.getOverview.queryOptions()));

export const useRecurring = () =>
  widgetQuery(useQuery(orpc.budget.getRecurring.queryOptions()));

export const useMonthCashFlows = (today: Date) => {
  const { isKnown, rule } = useBudgetMonth();
  const { current, previous } = dashboardMonths(today, rule);

  return {
    current: widgetQuery(
      useQuery(
        orpc.budget.getCashFlow.queryOptions({
          enabled: isKnown,
          input: current,
        })
      )
    ),
    previous: widgetQuery(
      useQuery(
        orpc.budget.getCashFlow.queryOptions({
          enabled: isKnown,
          input: previous,
        })
      )
    ),
    rule,
  };
};

export const useMonthlyCashFlow = (today: Date, months: number) => {
  const { isKnown, rule } = useBudgetMonth();

  return widgetQuery(
    useQuery(
      orpc.budget.getCashFlow.queryOptions({
        enabled: isKnown,
        input: { ...lastMonths(today, months, rule), grain: "month" },
      })
    )
  );
};

export const useMonthBreakdown = (today: Date) => {
  const { isKnown, rule } = useBudgetMonth();

  return widgetQuery(
    useQuery(
      orpc.budget.getSpendingBreakdown.queryOptions({
        enabled: isKnown,
        input: {
          ...dashboardMonths(today, rule).current,
          aggregation: "total",
        },
      })
    )
  );
};

export const useMonthBudget = (today: Date) => {
  const { isKnown, rule } = useBudgetMonth();

  return {
    query: widgetQuery(
      useQuery(
        orpc.budget.getBudgetVsActual.queryOptions({
          enabled: isKnown,
          input: {
            ...dashboardMonths(today, rule).current,
            aggregation: "total",
          },
        })
      )
    ),
    rule,
  };
};

export const useSpendingByWeek = (today: Date, weeks: number) =>
  widgetQuery(
    useQuery(
      orpc.budget.getSpendingByWeek.queryOptions({
        input: { to: endOfDay(today), weeks },
      })
    )
  );

export const useBalanceHistory = (today: Date, months: number) =>
  widgetQuery(
    useQuery(
      orpc.portfolio.getBalanceHistory.queryOptions({
        input: { months, today: endOfDay(today) },
      })
    )
  );

export interface TransactionsWidgetFilter {
  categories?: SpendingCategory[];
  count: number;
  months: number;
  search?: string;
}

export const transactionFiltersOf = (
  categories: SpendingCategory[] | undefined
): TransactionFilter[] | undefined =>
  categories && categories.length > 0
    ? [{ field: "category", operator: "isAnyOf", values: categories }]
    : undefined;

export const useWidgetTransactions = (
  today: Date,
  { categories, count, months, search }: TransactionsWidgetFilter
) => {
  const { isKnown, rule } = useBudgetMonth();

  return widgetQuery(
    useQuery({
      enabled: isKnown,
      queryFn: () =>
        client.budget.getTransactions({
          filters: transactionFiltersOf(categories),
          from: lastMonths(today, months, rule).from,
          limit: count,
          search,
          sort: "date",
          to: endOfDay(today),
        }),
      queryKey: [
        ...TRANSACTIONS_QUERY_KEY,
        "widget",
        {
          categories,
          count,
          months,
          rule,
          search,
          today: today.toISOString(),
        },
      ],
    })
  );
};
