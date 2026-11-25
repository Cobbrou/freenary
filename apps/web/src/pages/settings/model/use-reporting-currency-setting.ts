import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

export const AUTOMATIC_CURRENCY = "automatic";

export const useReportingCurrencySetting = () => {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.settings.getReportingCurrency.queryOptions());

  const saveMutation = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (currency: string | null) =>
      client.settings.saveReportingCurrency({ currency }),
    onError: (error) => {
      toast.error(
        error instanceof ORPCError && error.code === "BAD_REQUEST"
          ? m.settings_reporting_currency_no_rate_error()
          : m.settings_reporting_currency_save_error()
      );
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(
        orpc.settings.getReportingCurrency.queryKey(),
        saved
      );

      toast.success(m.settings_reporting_currency_saved());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.settings.key() }),
        invalidateBudgetData(queryClient),
      ]);
    },
  });

  const pendingChoice = saveMutation.isPending
    ? (saveMutation.variables ?? AUTOMATIC_CURRENCY)
    : undefined;

  return {
    choice: pendingChoice ?? query.data?.setting ?? AUTOMATIC_CURRENCY,
    isSaving: saveMutation.isPending,
    loadError: query.isError,
    reporting: query.data,
    save: (choice: string) =>
      saveMutation.mutate(choice === AUTOMATIC_CURRENCY ? null : choice),
  };
};
