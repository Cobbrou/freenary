export interface DashboardUpdate {
  dashboardIds: readonly string[];
  refresh: () => Promise<void>;
}

type DashboardUpdateListener = (update: DashboardUpdate) => void;

const listeners = new Set<DashboardUpdateListener>();

const once = (run: () => Promise<void>): (() => Promise<void>) => {
  let started: Promise<void> | undefined;

  return () => {
    started ??= run();

    return started;
  };
};

export const subscribeToDashboardUpdates = (
  listener: DashboardUpdateListener
) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const publishDashboardUpdate = ({
  dashboardIds,
  refresh,
}: DashboardUpdate) => {
  const refreshOnce = once(refresh);

  if (listeners.size === 0) {
    void refreshOnce();

    return;
  }

  for (const listener of listeners) {
    listener({ dashboardIds, refresh: refreshOnce });
  }
};
