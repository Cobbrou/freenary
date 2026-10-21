import { Progress } from "@freenary/ui/components/progress";
import { useEffect } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import type { SyncPhase, SyncProgressDetail } from "./sync-progress";
import { syncProgressShape } from "./sync-progress";
import { useAccountSync } from "./use-account-sync";

const SYNC_TOAST_ID = "account-sync-progress";

const PHASE_TITLES = {
  categorising: m.budget_sync_progress_categorising,
  importing: m.budget_sync_progress_importing,
} satisfies Record<SyncPhase, () => string>;

const detailText = (
  detail: SyncProgressDetail,
  numbers: Intl.NumberFormat
): string => {
  if (detail.kind === "transactions") {
    return m.budget_sync_progress_transactions({
      count: detail.count,
      formatted: numbers.format(detail.count),
    });
  }

  if (detail.kind === "accounts") {
    return m.budget_sync_progress_accounts({
      done: numbers.format(detail.done),
      total: numbers.format(detail.total),
    });
  }

  if (detail.kind === "categorised") {
    return m.budget_sync_progress_categorised({
      done: numbers.format(detail.done),
      total: numbers.format(detail.total),
    });
  }

  return m.budget_sync_progress_starting();
};

export const SyncProgressToast = () => {
  const progress = useAccountSync();

  useEffect(() => {
    if (progress === null) {
      toast.dismiss(SYNC_TOAST_ID);

      return;
    }

    const shape = syncProgressShape(progress);
    const detail = detailText(shape.detail, new Intl.NumberFormat(getLocale()));

    const title = PHASE_TITLES[shape.phase]();

    toast.loading(title, {
      description: (
        <span className="flex flex-col gap-1.5 pt-1">
          <span className="tabular-nums">{detail}</span>
          <Progress
            aria-label={title}
            aria-valuetext={detail}
            value={shape.percent}
          />
        </span>
      ),
      duration: Number.POSITIVE_INFINITY,
      id: SYNC_TOAST_ID,
    });
  }, [progress]);

  useEffect(
    () => () => {
      toast.dismiss(SYNC_TOAST_ID);
    },
    []
  );

  return null;
};
