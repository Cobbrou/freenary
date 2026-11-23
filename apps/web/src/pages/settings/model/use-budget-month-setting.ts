import type { BudgetMonthSetting } from "@freenary/api/lib/budget-month";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  budgetMonthQueryOptions,
  invalidateBudgetData,
} from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client } from "@/shared/api";

export const useBudgetMonthSetting = () => {
  const queryClient = useQueryClient();
  const query = useQuery(budgetMonthQueryOptions());

  const saveMutation = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (setting: BudgetMonthSetting) =>
      client.settings.saveBudgetMonth(setting),
    onError: () => {
      toast.error(m.settings_budget_month_save_error());
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(budgetMonthQueryOptions().queryKey, saved);
      toast.success(m.settings_budget_month_saved());
      await invalidateBudgetData(queryClient);
    },
  });

  return {
    isSaving: saveMutation.isPending,
    loadError: query.isError,
    save: (setting: BudgetMonthSetting) => saveMutation.mutate(setting),
    setting: saveMutation.isPending ? saveMutation.variables : query.data,
  };
};
