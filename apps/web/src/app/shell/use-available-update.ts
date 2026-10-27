import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

const RELEASE_STALE_TIME_MS = 60 * 60 * 1000;

export const useAvailableUpdate = () => {
  const { data: session } = authClient.useSession();

  const release = useQuery(
    orpc.instance.update.queryOptions({
      enabled: session !== null,
      staleTime: RELEASE_STALE_TIME_MS,
    })
  );

  return release.data?.latest ?? null;
};
