import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api";

export const useSyncProgress = () => {
  const { data: syncStatus } = useQuery(
    orpc.budget.getSyncStatus.queryOptions()
  );

  return syncStatus ?? null;
};
