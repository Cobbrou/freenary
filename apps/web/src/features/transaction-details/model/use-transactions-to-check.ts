import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

type ToCheckList = Awaited<
  ReturnType<typeof client.notifications.transactionsToCheck>
>;

export type TransactionToCheck = ToCheckList["transactions"][number];

interface Confirmation {
  category: SpendingCategory;
  transaction: TransactionToCheck;
}

export const useTransactionsToCheck = (notificationId: string | null) => {
  const queryClient = useQueryClient();
  const options = orpc.notifications.transactionsToCheck.queryOptions({
    enabled: notificationId !== null,
    input: { id: notificationId ?? "" },
  });

  const query = useQuery(options);

  const confirm = useMutation<
    unknown,
    Error,
    Confirmation,
    { previous: ToCheckList | undefined }
  >({
    meta: { errorShownInline: true },
    mutationFn: ({ category, transaction }) =>
      client.budget.updateTransactionCategory({
        category,
        transactionId: transaction.id,
      }),
    onError: (_error, _confirmation, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous);
      toast.error(m.budget_category_update_error());
    },
    onMutate: async ({ transaction }) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });

      const previous = queryClient.getQueryData<ToCheckList>(options.queryKey);

      queryClient.setQueryData<ToCheckList>(
        options.queryKey,
        (list) =>
          list && {
            transactions: list.transactions.filter(
              (row) => row.id !== transaction.id
            ),
          }
      );

      return { previous };
    },
    onSettled: () => invalidateBudgetData(queryClient),
  });

  const clear = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (id: string) =>
      client.notifications.clearTransactionsToCheck({ id }),
    onError: () => toast.error(m.to_check_clear_error()),
    onSettled: () => invalidateBudgetData(queryClient),
  });

  return {
    clear: () => {
      if (notificationId !== null) {
        clear.mutate(notificationId);
      }
    },
    confirm: (transaction: TransactionToCheck, category: SpendingCategory) =>
      confirm.mutate({ category, transaction }),
    query,
    transactions: query.data?.transactions ?? [],
  };
};
