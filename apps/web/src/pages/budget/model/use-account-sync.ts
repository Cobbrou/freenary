import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { client, invalidateBudgetData, orpc } from "@/shared/api";

interface SyncVariables {
  force?: boolean;
}

const SYNC_POLL_INTERVAL_MS = 1500;

const TRANSACTIONS_PER_REFRESH = 100;

export const useAccountSync = (hasAccounts: boolean | undefined) => {
  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: (variables: SyncVariables = {}) =>
      client.budget.syncAccounts({ force: variables.force }),
    onError: (_error, variables) => {
      toast.error(m.budget_sync_error(), {
        action: {
          label: m.budget_sync_retry(),
          onClick: () => syncMutation.mutate(variables),
        },
      });
    },
    onMutate: () =>
      queryClient.invalidateQueries({
        queryKey: orpc.budget.getSyncStatus.key(),
      }),
    onSuccess: async (sync, variables) => {
      await invalidateBudgetData(queryClient);

      if (!sync.success) {
        toast.error(m.budget_sync_error(), {
          action: {
            label: m.budget_sync_retry(),
            onClick: () => syncMutation.mutate(variables),
          },
        });

        return;
      }

      const wasAskedForByUser = variables.force === true;

      if (!(wasAskedForByUser && sync.started)) {
        return;
      }

      toast.success(
        sync.categorised > 0
          ? m.budget_sync_success_categorised({ count: sync.categorised })
          : m.budget_sync_success()
      );
    },
  });

  const isRequestInFlight = syncMutation.isPending;
  const statusQuery = useQuery({
    ...orpc.budget.getSyncStatus.queryOptions(),
    refetchInterval: (query) =>
      (query.state.data ?? null) === null && !isRequestInFlight
        ? false
        : SYNC_POLL_INTERVAL_MS,
  });

  const progress = statusQuery.data ?? null;
  const phase = progress?.phase ?? null;
  const importedTick = Math.floor(
    (progress?.transactionsImported ?? 0) / TRANSACTIONS_PER_REFRESH
  );

  const refreshKey = phase === null ? null : `${phase}:${importedTick}`;
  const refreshedKey = useRef<string | null>(null);

  useEffect(() => {
    if (refreshedKey.current === refreshKey) {
      return;
    }

    refreshedKey.current = refreshKey;

    void invalidateBudgetData(queryClient);
  }, [queryClient, refreshKey]);

  const hasStartedBackgroundSync = useRef(false);
  const isIdle = statusQuery.isSuccess && progress === null;

  useEffect(() => {
    if (hasAccounts && isIdle && !hasStartedBackgroundSync.current) {
      hasStartedBackgroundSync.current = true;
      syncMutation.mutate({});
    }
  }, [hasAccounts, isIdle, syncMutation]);

  return {
    isSyncing: isRequestInFlight || progress !== null,
    progress,
    resync: () => syncMutation.mutate({ force: true }),
  };
};
