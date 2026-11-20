import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { useQuery } from "@tanstack/react-query";

import { TRANSACTIONS_QUERY_KEY } from "@/entities/budget";
import { client, orpc } from "@/shared/api";

import { dashboardMonths, lastMonths } from "./finance";
import { widgetQuery } from "./widget-query";

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

export const useOverview = () =>
  widgetQuery(useQuery(orpc.portfolio.getOverview.queryOptions()));

export const useRecurring = () =>
  widgetQuery(useQuery(orpc.budget.getRecurring.queryOptions()));

export const useMonthCashFlows = (today: Date) => {
  const { current, previous } = dashboardMonths(today);

  return {
    current: widgetQuery(
      useQuery(orpc.budget.getCashFlow.queryOptions({ input: current }))
    ),
    previous: widgetQuery(
      useQuery(orpc.budget.getCashFlow.queryOptions({ input: previous }))
    ),
  };
};

export const useMonthlyCashFlow = (today: Date, months: number) =>
  widgetQuery(
    useQuery(
      orpc.budget.getCashFlow.queryOptions({
        input: { ...lastMonths(today, months), grain: "month" },
      })
    )
  );

export const useMonthBreakdown = (today: Date) =>
  widgetQuery(
    useQuery(
      orpc.budget.getSpendingBreakdown.queryOptions({
        input: { ...dashboardMonths(today).current, aggregation: "total" },
      })
    )
  );

export const useMonthBudget = (today: Date) =>
  widgetQuery(
    useQuery(
      orpc.budget.getBudgetVsActual.queryOptions({
        input: { ...dashboardMonths(today).current, aggregation: "total" },
      })
    )
  );

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
) =>
  widgetQuery(
    useQuery({
      queryFn: () =>
        client.budget.getTransactions({
          filters: transactionFiltersOf(categories),
          from: lastMonths(today, months).from,
          limit: count,
          search,
          sort: "date",
          to: endOfDay(today),
        }),
      queryKey: [
        ...TRANSACTIONS_QUERY_KEY,
        "widget",
        { categories, count, months, search, today: today.toISOString() },
      ],
    })
  );
