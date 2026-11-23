import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateBudgetData, recategoriseToEnd } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

export const useRecategoriseTransactions = () => {
  const queryClient = useQueryClient();

  const recategoriseMutation = useMutation({
    mutationFn: recategoriseToEnd,
    mutationKey: orpc.budget.recategorise.mutationKey(),
    onError: () => {
      toast.error(m.recategorise_error(), {
        action: {
          label: m.budget_sync_retry(),
          onClick: () => recategoriseMutation.mutate(),
        },
      });
    },
    onMutate: () =>
      queryClient.invalidateQueries({
        queryKey: orpc.budget.getSyncStatus.key(),
      }),
    onSuccess: async (run) => {
      await invalidateBudgetData(queryClient);

      if (!run.started) {
        toast.info(m.recategorise_sync_running());

        return;
      }

      if (run.failures.some((failure) => failure.kind === "categorisation")) {
        toast.error(m.recategorise_error(), {
          action: {
            label: m.budget_sync_retry(),
            onClick: () => recategoriseMutation.mutate(),
          },
        });

        return;
      }

      toast.success(
        run.categorised > 0
          ? m.recategorise_success({ count: run.categorised })
          : m.recategorise_finished()
      );
    },
  });

  return {
    isRecategorising: recategoriseMutation.isPending,
    recategorise: () => recategoriseMutation.mutate(),
  };
};
