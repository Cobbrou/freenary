import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

const DELETE_ACCOUNTS_KEY = ["bankConnection", "deleteAccounts"] as const;

export const useDeletingAccountIds = (): ReadonlySet<string> => {
  const pending = useMutationState({
    filters: { mutationKey: DELETE_ACCOUNTS_KEY, status: "pending" },
    select: ({ state: { variables } }) =>
      Array.isArray(variables)
        ? variables.filter((id): id is string => typeof id === "string")
        : [],
  });

  return new Set(pending.flat());
};

export const useDeleteAccounts = ({
  onDeleted,
}: { onDeleted?: () => void } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountIds: readonly string[]) =>
      client.bankConnection.deleteAccounts({ accountIds: [...accountIds] }),
    mutationKey: DELETE_ACCOUNTS_KEY,
    onError: () => {
      toast.error(m.bank_account_delete_error());
    },
    onSuccess: async ({ accountsRemoved }) => {
      await Promise.all([
        invalidateBudgetData(queryClient),
        queryClient.invalidateQueries({
          queryKey: orpc.budget.getSyncStatus.key(),
        }),
      ]);

      onDeleted?.();
      toast.success(m.bank_account_delete_success({ count: accountsRemoved }));
    },
  });
};
