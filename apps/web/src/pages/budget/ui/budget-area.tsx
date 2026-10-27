import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";

import { useSyncAccounts } from "@/features/account-sync";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { SyncButton } from "@/shared/ui/sync-button";

import { LoadError } from "./load-error";
import { NoBankAccount } from "./no-bank-account";

export const BudgetArea = () => {
  const accountsQuery = useQuery(orpc.budget.getAccounts.queryOptions());
  const { isSyncing, sync } = useSyncAccounts();

  const isAccountGateUndecided = accountsQuery.isPending;

  if (isAccountGateUndecided) {
    return null;
  }

  if (accountsQuery.isError) {
    return (
      <LoadError
        isRetrying={accountsQuery.isFetching}
        onRetry={() => {
          void accountsQuery.refetch();
        }}
        title={m.budget_load_error_title()}
      />
    );
  }

  if (!accountsQuery.data?.hasAccounts) {
    return <NoBankAccount />;
  }

  return (
    <div className="@container/budget flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-end">
        <SyncButton
          isSyncing={isSyncing}
          label={m.budget_sync_now()}
          onSync={() => sync({ force: true })}
        />
      </div>
      <Outlet />
    </div>
  );
};
