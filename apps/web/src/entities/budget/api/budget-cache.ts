import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/shared/api";

export const TRANSACTIONS_QUERY_KEY = ["budget", "getTransactions"] as const;

const SYNC_STATUS_PATH = "budget.getSyncStatus";

const isSyncStatusKey = (queryKey: readonly unknown[]): boolean => {
  const [path] = queryKey;

  return Array.isArray(path) && path.join(".") === SYNC_STATUS_PATH;
};

export const invalidateBudgetData = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({
      predicate: (query) => !isSyncStatusKey(query.queryKey),
      queryKey: orpc.budget.key(),
    }),
    queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY }),
  ]);
