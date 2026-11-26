import { EXCLUSION_OF_SCOPE } from "@freenary/api/lib/exclusion-scope";
import type {
  ExclusionScope,
  TransactionExclusion,
} from "@freenary/api/lib/exclusion-scope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateBudgetData,
  TRANSACTIONS_QUERY_KEY,
} from "@/entities/budget";
import type { Transaction } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client } from "@/shared/api";

interface ExclusionChange {
  isExcluded: boolean;
  scope: ExclusionScope;
}

export const useTransactionExclusion = (transaction: Transaction) => {
  const queryClient = useQueryClient();

  const holdsTransaction = (page: { transactions: Transaction[] }) =>
    page.transactions.some((tx) => tx.id === transaction.id);

  const patchExclusion = (exclusion: TransactionExclusion | null) => {
    queryClient.setQueriesData<{
      pageParams: unknown[];
      pages: { transactions: Transaction[] }[];
    }>({ queryKey: TRANSACTIONS_QUERY_KEY }, (old) => {
      if (!old?.pages) {
        return old;
      }

      if (!old.pages.some(holdsTransaction)) {
        return old;
      }

      return {
        ...old,
        pages: old.pages.map((page) =>
          holdsTransaction(page)
            ? {
                ...page,
                transactions: page.transactions.map((tx) =>
                  tx.id === transaction.id ? { ...tx, exclusion } : tx
                ),
              }
            : page
        ),
      };
    });
  };

  return useMutation<
    unknown,
    Error,
    ExclusionChange,
    { previous: TransactionExclusion | null }
  >({
    mutationFn: ({ isExcluded, scope }) => {
      const input = { excluded: isExcluded, transactionId: transaction.id };

      return scope === "merchant"
        ? client.budget.excludeMerchant(input)
        : client.budget.excludeTransaction(input);
    },
    onError: (_error, _change, context) => {
      if (context) {
        patchExclusion(context.previous);
      }

      toast.error(m.budget_exclusion_update_error());
    },
    onMutate: async ({ isExcluded, scope }) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY });

      const previous = transaction.exclusion ?? null;

      patchExclusion(isExcluded ? EXCLUSION_OF_SCOPE[scope] : null);

      return { previous };
    },
    onSettled: () => invalidateBudgetData(queryClient),
  });
};
