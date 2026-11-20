import { useEffect, useEffectEvent } from "react";

import type { DashboardUpdate } from "./dashboard-updates";
import { subscribeToDashboardUpdates } from "./dashboard-updates";

export const useDashboardUpdates = (
  onUpdate: (update: DashboardUpdate) => void
) => {
  const handleUpdate = useEffectEvent(onUpdate);

  useEffect(() => subscribeToDashboardUpdates(handleUpdate), []);
};
