import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import type { QueryClient } from "@tanstack/react-query";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

import { TRANSACTIONS_QUERY_KEY } from "@/entities/budget";
import { client, orpc } from "@/shared/api";

import type { AggregationMode } from "../model/period";
import type { SortMode, TransactionDirection } from "../model/search";

export interface PeriodInput {
  aggregation: AggregationMode;
  from: Date;
  to: Date;
}

export interface TransactionsInput {
  direction: TransactionDirection;
  filters: TransactionFilter[];
  from: Date;
  search: string;
  sort: SortMode;
  to: Date;
}

const PAGE_SIZE = 50;

// SAFETY: TanStack Query requires initialPageParam typed to match pageParam; undefined is the valid initial state
const INITIAL_PAGE_PARAM = undefined as string | undefined;

export const transactionsQueryOptions = ({
  direction,
  filters,
  from,
  search,
  sort,
  to,
}: TransactionsInput) =>
  // oxlint-disable-next-line sort-keys -- TanStack infers the page type from `queryFn`, so a later `getNextPageParam` reads its `lastPage`; alphabetical order puts it first, where the page is `unknown`.
  infiniteQueryOptions({
    queryKey: [
      ...TRANSACTIONS_QUERY_KEY,
      {
        direction,
        filters,
        from: from.toISOString(),
        search,
        sort,
        to: to.toISOString(),
      },
    ],
    queryFn: ({ pageParam }) =>
      client.budget.getTransactions({
        cursor: pageParam,
        direction,
        filters: filters.length > 0 ? filters : undefined,
        from,
        limit: PAGE_SIZE,
        search: search || undefined,
        sort,
        to,
      }),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

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
      orpc.budget.getPeriodOverview.queryOptions({ input: period })
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
