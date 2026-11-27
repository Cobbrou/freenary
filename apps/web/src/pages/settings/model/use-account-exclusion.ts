import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PortfolioAccount } from "@/entities/account";
import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

interface AccountExclusionChange {
  isExcluded: boolean;
  reason?: string | null;
}

export const useAccountExclusion = (account: PortfolioAccount) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ isExcluded, reason }: AccountExclusionChange) =>
      client.budget.excludeAccount({
        accountId: account.id,
        excluded: isExcluded,
        reason,
      }),
    onError: () => {
      toast.error(m.bank_account_exclusion_update_error());
    },
    onSettled: () => invalidateBudgetData(queryClient),
    onSuccess: ({ rematchStarted }) => {
      if (!rematchStarted) {
        return;
      }

      return queryClient.invalidateQueries({
        queryKey: orpc.budget.getSyncStatus.key(),
      });
    },
  });

  const pending = mutation.isPending ? mutation.variables : undefined;

  return {
    isExcluded: pending ? pending.isExcluded : account.excluded,
    isPending: mutation.isPending,
    mutate: mutation.mutate,
    reason:
      pending?.reason === undefined ? account.exclusionReason : pending.reason,
  };
};
