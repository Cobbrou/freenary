import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { invalidateBudgetData } from "@/entities/budget";
import { useSyncAccounts } from "@/features/account-sync";
import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

const SYNC_POLL_INTERVAL_MS = 1500;

const TRANSACTIONS_PER_REFRESH = 100;

export const useAccountSync = () => {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const { isRequestInFlight, sync } = useSyncAccounts();

  const onboardingQuery = useQuery(
    orpc.onboarding.getStatus.queryOptions({ enabled: session !== null })
  );

  const isMember = onboardingQuery.data?.completed === true;

  const connectionsQuery = useQuery(
    orpc.bankConnection.listConnections.queryOptions({ enabled: isMember })
  );

  const hasActiveConnection =
    connectionsQuery.data?.connections.some(
      (connection) => connection.status === "ACTIVE"
    ) ?? false;

  const statusQuery = useQuery(
    orpc.budget.getSyncStatus.queryOptions({
      enabled: isMember,
      refetchInterval: (query) =>
        (query.state.data ?? null) === null && !isRequestInFlight
          ? false
          : SYNC_POLL_INTERVAL_MS,
    })
  );

  const progress = statusQuery.data ?? null;
  const phase = progress?.phase ?? null;
  const importedTick = Math.floor(
    (progress?.transactionsImported ?? 0) / TRANSACTIONS_PER_REFRESH
  );

  const refreshKey = phase === null ? null : `${phase}:${importedTick}`;
  const refreshedKey = useRef<string | null>(null);

  useEffect(() => {
    if (refreshedKey.current === refreshKey) {
      return;
    }

    refreshedKey.current = refreshKey;

    void invalidateBudgetData(queryClient);
  }, [queryClient, refreshKey]);

  const hasStartedBackgroundSync = useRef(false);
  const isIdle = statusQuery.isSuccess && progress === null;

  useEffect(() => {
    if (hasActiveConnection && isIdle && !hasStartedBackgroundSync.current) {
      hasStartedBackgroundSync.current = true;
      sync({});
    }
  }, [hasActiveConnection, isIdle, sync]);

  return progress;
};
