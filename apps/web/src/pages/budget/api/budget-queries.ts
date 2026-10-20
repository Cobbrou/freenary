import type { QueryClient } from "@tanstack/react-query";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

import type { CategoryFilter } from "@/entities/category";
import { client, orpc } from "@/shared/api";

import type { AggregationMode } from "../model/period";
import type { SortMode, TransactionDirection } from "../model/search";
import { amountBoundsMinor } from "../model/transaction-filters";
import type { AmountRange } from "../model/transaction-filters";

export interface PeriodInput {
  aggregation: AggregationMode;
  from: Date;
  to: Date;
}

export interface TransactionsInput {
  amount: AmountRange;
  direction: TransactionDirection;
  filter: CategoryFilter;
  from: Date;
  merchants: string[];
  search: string;
  sort: SortMode;
  to: Date;
}

export const TRANSACTIONS_QUERY_KEY = ["budget", "getTransactions"] as const;

const PAGE_SIZE = 50;

// SAFETY: TanStack Query requires initialPageParam typed to match pageParam; undefined is the valid initial state
const INITIAL_PAGE_PARAM = undefined as string | undefined;

export const transactionsQueryOptions = ({
  amount,
  direction,
  filter,
  from,
  merchants,
  search,
  sort,
  to,
}: TransactionsInput) => {
  const { amountMax, amountMin } = amountBoundsMinor(amount);

  // oxlint-disable-next-line sort-keys -- TanStack infers the page type from `queryFn`, so a later `getNextPageParam` reads its `lastPage`; alphabetical order puts it first, where the page is `unknown`.
  return infiniteQueryOptions({
    queryKey: [
      ...TRANSACTIONS_QUERY_KEY,
      {
        amountMax,
        amountMin,
        direction,
        filter,
        from: from.toISOString(),
        merchants,
        search,
        sort,
        to: to.toISOString(),
      },
    ],
    queryFn: ({ pageParam }) =>
      client.budget.getTransactions({
        amountMax,
        amountMin,
        categories:
          filter.categories.length > 0 ? filter.categories : undefined,
        cursor: pageParam,
        direction,
        from,
        groups: filter.groups.length > 0 ? filter.groups : undefined,
        limit: PAGE_SIZE,
        merchants: merchants.length > 0 ? merchants : undefined,
        search: search || undefined,
        sort,
        to,
      }),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
};

const warmWithoutRaising = async (fetching: Promise<unknown>[]) => {
  await Promise.allSettled(fetching);
};

export const prefetchTransactions = (
  queryClient: QueryClient,
  input: TransactionsInput
) => {
  void warmWithoutRaising([
    queryClient.infiniteQuery(transactionsQueryOptions(input)),
  ]);
};

export const prefetchPeriod = (
  queryClient: QueryClient,
  period: PeriodInput,
  list: Omit<TransactionsInput, "from" | "to">
) => {
  void warmWithoutRaising([
    queryClient.query(
      orpc.budget.getSpendingBreakdown.queryOptions({ input: period })
    ),
    queryClient.query(
      orpc.budget.getSankeyData.queryOptions({ input: period })
    ),
    queryClient.query(
      orpc.budget.getFixedVsVariable.queryOptions({ input: period })
    ),
    queryClient.query(
      orpc.budget.getBudgetVsActual.queryOptions({ input: period })
    ),
    queryClient.infiniteQuery(
      transactionsQueryOptions({ ...list, from: period.from, to: period.to })
    ),
  ]);
};

export const isStaleView = (query: {
  isFetching: boolean;
  isPlaceholderData: boolean;
}) => query.isPlaceholderData && query.isFetching;
