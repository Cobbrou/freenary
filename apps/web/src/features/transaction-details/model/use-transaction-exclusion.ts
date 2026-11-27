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
  reason?: string | null;
  scope: Exclude<ExclusionScope, "account">;
}

interface ExclusionState {
  exclusion: TransactionExclusion | null;
  exclusionReason: string | null;
}

export const useTransactionExclusion = (transaction: Transaction) => {
  const queryClient = useQueryClient();

  const holdsTransaction = (page: { transactions: Transaction[] }) =>
    page.transactions.some((tx) => tx.id === transaction.id);

  const patchExclusion = (state: ExclusionState) => {
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
                  tx.id === transaction.id ? { ...tx, ...state } : tx
                ),
              }
            : page
        ),
      };
    });
  };

  return useMutation<
    ExclusionState,
    Error,
    ExclusionChange,
    { previous: ExclusionState }
  >({
    mutationFn: ({ isExcluded, reason, scope }) => {
      const input = {
        excluded: isExcluded,
        reason,
        transactionId: transaction.id,
      };

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
    onMutate: async ({ isExcluded, reason, scope }) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY });

      const previous = {
        exclusion: transaction.exclusion ?? null,
        exclusionReason: transaction.exclusionReason ?? null,
      };

      const lifted =
        previous.exclusion === EXCLUSION_OF_SCOPE[scope] ? null : previous;

      patchExclusion(
        isExcluded
          ? {
              exclusion: previous.exclusion ?? EXCLUSION_OF_SCOPE[scope],
              exclusionReason:
                reason === undefined ? previous.exclusionReason : reason,
            }
          : (lifted ?? { exclusion: null, exclusionReason: null })
      );

      return { previous };
    },
    onSettled: () => invalidateBudgetData(queryClient),
    onSuccess: ({ exclusion, exclusionReason }) =>
      patchExclusion({ exclusion, exclusionReason }),
  });
};
