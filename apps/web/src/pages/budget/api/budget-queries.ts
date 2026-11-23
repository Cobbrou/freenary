import type { QueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";

import { transactionsQueryOptions } from "@/features/transaction-list";
import type { TransactionsInput } from "@/features/transaction-list";
import { orpc } from "@/shared/api";

import type { AggregationMode } from "../model/period";

export interface PeriodInput {
  aggregation: AggregationMode;
  from: Date;
  to: Date;
}

export const periodOverviewQueryOptions = (period: PeriodInput) =>
  orpc.budget.getPeriodOverview.queryOptions({
    input: period,
    placeholderData: keepPreviousData,
  });

export const isStaleView = (query: {
  isFetching: boolean;
  isPlaceholderData: boolean;
}) => query.isPlaceholderData && query.isFetching;

const warmWithoutRaising = async (fetching: Promise<unknown>[]) => {
  await Promise.allSettled(fetching);
};

export const prefetchPeriod = (
  queryClient: QueryClient,
  period: PeriodInput,
  list: Omit<TransactionsInput, "from" | "to">
) => {
  void warmWithoutRaising([
    queryClient.query(periodOverviewQueryOptions(period)),
    queryClient.infiniteQuery(
      transactionsQueryOptions({ ...list, from: period.from, to: period.to })
    ),
  ]);
};
