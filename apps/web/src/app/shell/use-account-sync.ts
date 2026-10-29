import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { invalidateBudgetData, SYNC_POLL_INTERVAL_MS } from "@/entities/budget";
import { useSyncAccounts } from "@/features/account-sync";
import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

const BUDGET_REFRESH_INTERVAL_MS = 5000;

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
  const lastRefresh = useRef<{ at: number; phase: string | null }>({
    at: 0,
    phase: null,
  });

  useEffect(() => {
    const phase = progress?.phase ?? null;
    const now = Date.now();
    const isSamePhase = lastRefresh.current.phase === phase;
    const isRecent = now - lastRefresh.current.at < BUDGET_REFRESH_INTERVAL_MS;

    if (isSamePhase && (phase === null || isRecent)) {
      return;
    }

    lastRefresh.current = { at: now, phase };

    void invalidateBudgetData(queryClient);
  }, [progress, queryClient]);

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
