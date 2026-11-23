import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import type { CategorySelection } from "@/entities/category";
import { TransactionDetailDrawer } from "@/features/transaction-details";
import {
  highlightedChartCategories,
  recentMonths,
  selectChartCategory,
  TransactionList,
  useTransactionListQuery,
} from "@/features/transaction-list";
import type {
  MonthChoice,
  TransactionGrouping,
  TransactionsInput,
} from "@/features/transaction-list";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { orpc } from "@/shared/api";
import { useNow } from "@/shared/lib/calendar-day";

import {
  isStaleView,
  periodOverviewQueryOptions,
  prefetchPeriod,
} from "../api/budget-queries";
import type { PeriodInput } from "../api/budget-queries";
import type { TimeRange } from "../model/period";
import { useBudgetCurrency } from "../model/use-budget-currency";
import { useBudgetMonthRule } from "../model/use-budget-month-rule";
import { useBudgetView } from "../model/use-budget-view";
import { useSyncProgress } from "../model/use-sync-progress";
import { BudgetCharts } from "./budget-charts";
import { BudgetKpiStrip } from "./budget-kpi-strip";
import { PeriodNavigator } from "./period-navigator";

type PeriodOverview =
  InferRouterOutputs<AppRouter>["budget"]["getPeriodOverview"];

const overviewSections = (overview: PeriodOverview | undefined) => ({
  budgetVsActual: overview?.budgetVsActual,
  fixedVsVariable: overview?.fixedVsVariable,
  sankey: overview?.sankey,
  spendingBreakdown: overview?.spendingBreakdown,
  totalExpenses: overview?.sankey.totalExpenses ?? 0,
  totalIncome: overview?.sankey.totalIncome ?? 0,
});

const GROUPING_OF_RANGE = {
  "1M": "day",
  "1Y": "month",
  "3M": "week",
} as const satisfies Record<TimeRange, TransactionGrouping>;

export const TransactionsPage = () => {
  const accountsQuery = useQuery(orpc.budget.getAccounts.queryOptions());
  const currency = useBudgetCurrency();
  const rule = useBudgetMonthRule();
  const {
    applyPatch,
    companion,
    direction,
    filters,
    period,
    searchQuery,
    setSearchQuery,
    sort,
    view,
  } = useBudgetView({
    dateBounds: accountsQuery.data
      ? {
          first: accountsQuery.data.firstTransactionDate,
          last: accountsQuery.data.lastTransactionDate,
        }
      : undefined,
    rule,
  });

  const {
    aggregation,
    anchor,
    firstMonth,
    from,
    lastMonth,
    previewMonth,
    previewRange,
    range,
    setAggregation: handleAggregationChange,
    setMonth: handleMonthChange,
    setRange: handleRangeChange,
    to,
  } = period;

  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);

  const overviewQuery = useQuery(
    periodOverviewQueryOptions({ aggregation, from, to })
  );

  const listInput = useMemo<TransactionsInput>(
    () => ({
      direction,
      filters,
      from,
      search: searchQuery,
      sort,
      to,
    }),
    [direction, filters, from, searchQuery, sort, to]
  );

  const syncProgress = useSyncProgress();
  const hasNoHistoryYet =
    accountsQuery.isSuccess && accountsQuery.data.firstTransactionDate === null;

  const isAwaitingFirstData = syncProgress !== null && hasNoHistoryYet;
  const transactionList = useTransactionListQuery(listInput, {
    isAwaitingFirstData,
  });

  const queryClient = useQueryClient();

  const handlePeriodIntent = useCallback(
    (target: PeriodInput) => prefetchPeriod(queryClient, target, listInput),
    [listInput, queryClient]
  );

  const handleFiltersChange = useCallback(
    (next: TransactionFilter[]) => applyPatch({ filters: next }),
    [applyPatch]
  );

  const handleSearchReplace = useCallback(
    (next: { filters: TransactionFilter[]; search: string }) =>
      applyPatch({ filters: next.filters, q: next.search }),
    [applyPatch]
  );

  const accounts = useMemo(
    () =>
      (accountsQuery.data?.accounts ?? []).map((account) => ({
        id: account.id,
        label: account.name ?? account.institutionName,
      })),
    [accountsQuery.data]
  );

  const now = useNow();
  const months = useMemo(
    () =>
      recentMonths({
        current: range === "1M" ? anchor : null,
        first: firstMonth,
        last: lastMonth ?? now,
        locale: getLocale(),
      }),
    [anchor, firstMonth, lastMonth, now, range]
  );

  const handleMonthPick = useCallback(
    ({ month, year }: MonthChoice) =>
      applyPatch({ agg: "total", month, range: "1M", year }),
    [applyPatch]
  );

  const chartCategories = useMemo(
    () => highlightedChartCategories(filters),
    [filters]
  );

  const handleSelect = useCallback(
    (selection: CategorySelection | null) =>
      handleFiltersChange(selectChartCategory(filters, selection)),
    [filters, handleFiltersChange]
  );

  const overview = overviewSections(overviewQuery.data);
  const overviewState = {
    isError: overviewQuery.isError,
    isPending: overviewQuery.isLoading || isAwaitingFirstData,
    isStale: isStaleView(overviewQuery),
  };

  const selectedTransaction = selectedTransactionId
    ? (transactionList.transactions.find(
        (t) => t.id === selectedTransactionId
      ) ?? null)
    : null;

  const isUpdating = isStaleView(overviewQuery) || transactionList.isStale;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {isUpdating ? (
        <output className="sr-only">{m.budget_view_updating()}</output>
      ) : null}

      <PeriodNavigator
        aggregation={aggregation}
        anchor={anchor}
        from={from}
        to={to}
        range={range}
        rule={rule}
        firstMonth={firstMonth}
        lastMonth={lastMonth}
        onAggregationChange={handleAggregationChange}
        onRangeChange={handleRangeChange}
        onRangeIntent={(next) => handlePeriodIntent(previewRange(next))}
        onMonthChange={handleMonthChange}
        onMonthIntent={(year, month) =>
          handlePeriodIntent(previewMonth(year, month))
        }
      />

      <BudgetKpiStrip
        aggregation={aggregation}
        currency={currency}
        {...overviewState}
        totalExpenses={overview.totalExpenses}
        totalIncome={overview.totalIncome}
      />

      <BudgetCharts
        activeCategories={chartCategories}
        aggregation={aggregation}
        breakdown={{
          ...overviewState,
          data: overview.spendingBreakdown,
        }}
        cashFlow={{ ...overviewState, data: overview.sankey }}
        companion={companion}
        fixedVsVariable={{
          ...overviewState,
          data: overview.fixedVsVariable,
        }}
        onCompanionChange={(next) => applyPatch({ companion: next })}
        onSelect={handleSelect}
        onViewChange={(next) => applyPatch({ view: next })}
        planned={{ ...overviewState, data: overview.budgetVsActual }}
        view={view}
      />

      <TransactionList
        {...transactionList}
        accounts={accounts}
        months={months}
        onMonthPick={handleMonthPick}
        currency={currency}
        direction={direction}
        onDirectionChange={(dir) => applyPatch({ dir })}
        from={from}
        to={to}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearchReplace={handleSearchReplace}
        sort={sort}
        onSortChange={(next) => applyPatch({ sort: next })}
        onTransactionClick={(tx) => setSelectedTransactionId(tx.id)}
        grouping={GROUPING_OF_RANGE[range]}
      />

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={selectedTransactionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransactionId(null);
          }
        }}
      />
    </div>
  );
};
