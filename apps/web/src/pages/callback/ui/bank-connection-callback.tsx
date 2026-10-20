import { Skeleton } from "@freenary/ui/components/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { invalidateBudgetData, orpc } from "@/shared/api";

export const ConnectingBank = () => (
  <div
    aria-busy="true"
    className="flex min-h-svh flex-col items-center justify-center gap-4"
  >
    <output className="sr-only">{m.bank_callback_loading()}</output>
    <div aria-hidden="true" className="flex flex-col items-center gap-4">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-col gap-2 text-center">
        <Skeleton className="mx-auto h-4 w-52" />
        <Skeleton className="mx-auto h-3 w-36" />
      </div>
    </div>
  </div>
);

export const BankConnectionCallback = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { exchangeResult } = useRouteContext({ from: "/callback/$provider" });

  useEffect(() => {
    if (exchangeResult.ok) {
      const count = exchangeResult.accounts.length;
      const message =
        count > 0
          ? m.bank_callback_success_accounts({ count })
          : m.bank_callback_success();

      toast.success(message);
      void queryClient.invalidateQueries({
        queryKey: orpc.bankConnection.listConnections.queryOptions().queryKey,
      });

      void invalidateBudgetData(queryClient);
    } else if (exchangeResult.reason === "declined") {
      toast.error(m.bank_callback_declined());
    } else if (exchangeResult.reason === "failed") {
      toast.error(
        exchangeResult.returnTo === "settings"
          ? m.bank_callback_failed_settings()
          : m.bank_callback_failed_onboarding()
      );
    } else {
      toast.error(m.bank_callback_incomplete());
    }

    if (exchangeResult.returnTo === "settings") {
      navigate({ search: { section: "connections" }, to: "/settings" });

      return;
    }

    navigate({ to: "/onboarding" });
  }, [exchangeResult, navigate, queryClient]);

  return <ConnectingBank />;
};
