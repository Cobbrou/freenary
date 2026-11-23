import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  prefetchTransactions,
  transactionsQueryOptions,
} from "../api/transactions-query";
import type { TransactionsInput } from "../api/transactions-query";
import type { SortMode, TransactionDirection } from "./list-search";

const NO_TOTALS = { incoming: 0, outgoing: 0 };

export const useTransactionListQuery = (
  input: TransactionsInput,
  { isAwaitingFirstData = false }: { isAwaitingFirstData?: boolean } = {}
) => {
  const query = useInfiniteQuery(transactionsQueryOptions(input));
  const queryClient = useQueryClient();

  const onDirectionIntent = useCallback(
    (direction: TransactionDirection) =>
      prefetchTransactions(queryClient, { ...input, direction }),
    [input, queryClient]
  );

  const onSortIntent = useCallback(
    (sort: SortMode) => prefetchTransactions(queryClient, { ...input, sort }),
    [input, queryClient]
  );

  const onLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const onRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    hasMore: query.hasNextPage,
    isError: query.isError && !query.isFetchNextPageError,
    isLoading:
      query.isLoading || isAwaitingFirstData || query.isFetchingNextPage,
    isRetrying: query.isFetching,
    isStale: query.isPlaceholderData && query.isFetching,
    onDirectionIntent,
    onLoadMore,
    onRetry,
    onSortIntent,
    totals: query.data?.pages[0]?.totals ?? NO_TOTALS,
    transactions: query.data?.pages.flatMap((page) => page.transactions) ?? [],
  };
};
