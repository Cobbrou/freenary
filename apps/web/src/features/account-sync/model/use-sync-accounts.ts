import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

interface SyncVariables {
  force?: boolean;
}

export const useSyncAccounts = () => {
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: (variables: SyncVariables = {}) =>
      client.budget.syncAccounts({ force: variables.force }),
    mutationKey: orpc.budget.syncAccounts.mutationKey(),
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

  const isRequestInFlight =
    useIsMutating({ mutationKey: orpc.budget.syncAccounts.mutationKey() }) > 0;

  const { data: progress } = useQuery({
    ...orpc.budget.getSyncStatus.queryOptions(),
    enabled: false,
  });

  return {
    isRequestInFlight,
    isSyncing: isRequestInFlight || (progress ?? null) !== null,
    sync: syncMutation.mutate,
  };
};
