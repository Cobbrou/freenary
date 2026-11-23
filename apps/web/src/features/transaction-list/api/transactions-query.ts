import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import type { QueryClient } from "@tanstack/react-query";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";

import { TRANSACTIONS_QUERY_KEY } from "@/entities/budget";
import { client } from "@/shared/api";

import type { SortMode, TransactionDirection } from "../model/list-search";

export interface TransactionsInput {
  accountId?: string;
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
  accountId,
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
        accountId,
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
        accountId,
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
