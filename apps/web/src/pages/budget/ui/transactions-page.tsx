import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import type { CategorySelection } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import {
  isStaleView,
  periodOverviewQueryOptions,
  prefetchPeriod,
  prefetchTransactions,
  transactionsQueryOptions,
} from "../api/budget-queries";
import type { PeriodInput, TransactionsInput } from "../api/budget-queries";
import {
  highlightedChartCategories,
  selectChartCategory,
} from "../model/filter-tokens";
import type { SortMode, TransactionDirection } from "../model/search";
import { useBudgetView } from "../model/use-budget-view";
import { useSyncProgress } from "../model/use-sync-progress";
import { BudgetCharts } from "./budget-charts";
import { BudgetKpiStrip } from "./budget-kpi-strip";
import { PeriodNavigator } from "./period-navigator";
import { TransactionDetailDrawer } from "./transaction-detail-drawer";
import { TransactionList } from "./transaction-list";

type PeriodOverview =
  InferRouterOutputs<AppRouter>["budget"]["getPeriodOverview"];

const overviewSections = (overview: PeriodOverview | undefined) => ({
  budgetVsActual: overview?.budgetVsActual,
  fixedVsVariable: overview?.fixedVsVariable,
  sankey: overview?.sankey,
  spendingBreakdown: overview?.spendingBreakdown.categories,
  totalExpenses: overview?.sankey.totalExpenses ?? 0,
  totalIncome: overview?.sankey.totalIncome ?? 0,
});

export const TransactionsPage = () => {
  const accountsQuery = useQuery(orpc.budget.getAccounts.queryOptions());
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
  });

  const {
    aggregation,
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

  const transactionsQuery = useInfiniteQuery(
    transactionsQueryOptions(listInput)
  );

  const queryClient = useQueryClient();

  const handleDirectionIntent = useCallback(
    (dir: TransactionDirection) =>
      prefetchTransactions(queryClient, { ...listInput, direction: dir }),
    [listInput, queryClient]
  );

  const handleSortIntent = useCallback(
    (next: SortMode) =>
      prefetchTransactions(queryClient, { ...listInput, sort: next }),
    [listInput, queryClient]
  );

  const handlePeriodIntent = useCallback(
    (target: PeriodInput) => prefetchPeriod(queryClient, target, listInput),
    [listInput, queryClient]
  );

  const handleLoadMore = useCallback(() => {
    if (
      transactionsQuery.hasNextPage &&
      !transactionsQuery.isFetchingNextPage
    ) {
      transactionsQuery.fetchNextPage();
    }
  }, [transactionsQuery]);

  const handleFiltersChange = useCallback(
    (next: TransactionFilter[]) => applyPatch({ filters: next }),
    [applyPatch]
  );

  const handleSearchReplace = useCallback(
    (next: { filters: TransactionFilter[]; search: string }) =>
      applyPatch({ filters: next.filters, q: next.search }),
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

  const allTransactions =
    transactionsQuery.data?.pages.flatMap((p) => p.transactions) ?? [];

  const totals = transactionsQuery.data?.pages[0]?.totals ?? {
    incoming: 0,
    outgoing: 0,
  };

  const syncProgress = useSyncProgress();
  const hasNoHistoryYet =
    accountsQuery.isSuccess && accountsQuery.data.firstTransactionDate === null;

  const isAwaitingFirstData = syncProgress !== null && hasNoHistoryYet;
  const isFilling = (isLoading: boolean) => isLoading || isAwaitingFirstData;
  const overview = overviewSections(overviewQuery.data);
  const overviewState = {
    isError: overviewQuery.isError,
    isPending: isFilling(overviewQuery.isLoading),
    isStale: isStaleView(overviewQuery),
  };

  const selectedTransaction = selectedTransactionId
    ? (allTransactions.find((t) => t.id === selectedTransactionId) ?? null)
    : null;

  const isUpdating = [overviewQuery, transactionsQuery].some(isStaleView);

  return (
    <div className="flex flex-1 flex-col gap-6">
      {isUpdating ? (
        <output className="sr-only">{m.budget_view_updating()}</output>
      ) : null}

      <PeriodNavigator
        aggregation={aggregation}
        to={to}
        range={range}
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
        fixedVsVariable={{ ...overviewState, data: overview.fixedVsVariable }}
        onCompanionChange={(next) => applyPatch({ companion: next })}
        onSelect={handleSelect}
        onViewChange={(next) => applyPatch({ view: next })}
        planned={{ ...overviewState, data: overview.budgetVsActual }}
        view={view}
      />

      <TransactionList
        transactions={allTransactions}
        totals={totals}
        direction={direction}
        onDirectionChange={(dir) => applyPatch({ dir })}
        onDirectionIntent={handleDirectionIntent}
        from={from}
        to={to}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearchReplace={handleSearchReplace}
        sort={sort}
        onSortChange={(next) => applyPatch({ sort: next })}
        onSortIntent={handleSortIntent}
        hasMore={transactionsQuery.hasNextPage}
        onLoadMore={handleLoadMore}
        isLoading={
          isFilling(transactionsQuery.isLoading) ||
          transactionsQuery.isFetchingNextPage
        }
        isError={
          transactionsQuery.isError && !transactionsQuery.isFetchNextPageError
        }
        isRetrying={transactionsQuery.isFetching}
        onRetry={() => {
          void transactionsQuery.refetch();
        }}
        isStale={isStaleView(transactionsQuery)}
        onTransactionClick={(tx) => setSelectedTransactionId(tx.id)}
        range={range}
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
