import { orpc } from "@/shared/api";

const POLL_INTERVAL_MS = 60_000;

export const notificationsQueryKey = () => orpc.notifications.key();

export const notificationsQueryOptions = () =>
  orpc.notifications.list.queryOptions({
    refetchInterval: POLL_INTERVAL_MS,
  });
