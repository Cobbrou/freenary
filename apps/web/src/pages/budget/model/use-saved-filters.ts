import {
  MAX_SAVED_FILTERS,
  SAVED_FILTER_LIMIT_ERROR,
} from "@freenary/api/lib/transaction-filters";
import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import type { AppRouter } from "@freenary/api/routers/index";
import { ORPCError } from "@orpc/client";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

export type SavedFilter =
  InferRouterOutputs<AppRouter>["budget"]["listSavedFilters"]["savedFilters"][number];

export interface SavedFilterDraft {
  filters: TransactionFilter[];
  name: string;
  search: string;
}

export const useSavedFilters = ({ isListShown }: { isListShown: boolean }) => {
  const queryClient = useQueryClient();
  const listOptions = orpc.budget.listSavedFilters.queryOptions();

  const savedFiltersQuery = useQuery({ ...listOptions, enabled: isListShown });

  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: listOptions.queryKey });

  const saveMutation = useMutation({
    mutationFn: (draft: SavedFilterDraft) => client.budget.saveFilter(draft),
    onError: (error, { name }) => {
      const isAtCap =
        error instanceof ORPCError && error.code === SAVED_FILTER_LIMIT_ERROR;

      toast.error(
        isAtCap
          ? m.budget_saved_filter_limit({ count: MAX_SAVED_FILTERS })
          : m.budget_saved_filter_save_error({ name })
      );
    },
    onSuccess: async ({ name, replaced }) => {
      await refreshList();
      toast.success(
        replaced
          ? m.budget_saved_filter_replaced({ name })
          : m.budget_saved_filter_saved({ name })
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: SavedFilter) =>
      client.budget.deleteSavedFilter({ id }),
    onError: (_error, { name }) => {
      toast.error(m.budget_saved_filter_delete_error({ name }));
    },
    onSuccess: async (_deleted, { filters, name, search }) => {
      await refreshList();
      toast.success(m.budget_saved_filter_deleted({ name }), {
        action: {
          label: m.budget_saved_filter_undo(),
          onClick: () => saveMutation.mutate({ filters, name, search }),
        },
      });
    },
  });

  return {
    deleteSavedFilter: deleteMutation.mutate,
    deletingId: deleteMutation.isPending
      ? (deleteMutation.variables?.id ?? null)
      : null,
    isSaving: saveMutation.isPending,
    saveFilter: saveMutation.mutate,
    savedFiltersQuery,
  };
};
