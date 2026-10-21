export type SyncPhase = "categorising" | "importing";

export interface SyncProgress {
  phase: SyncPhase;
  accountsDone: number;
  accountsTotal: number;
  transactionsImported: number;
  categorised: number;
  categorisedTotal: number;
}

export type SyncProgressDetail =
  | { kind: "accounts"; done: number; total: number }
  | { kind: "categorised"; done: number; total: number }
  | { kind: "starting" }
  | { kind: "transactions"; count: number };

export interface SyncProgressShape {
  phase: SyncPhase;
  percent: number | null;
  detail: SyncProgressDetail;
}

const PERCENT = 100;

const categorisingShape = (progress: SyncProgress): SyncProgressShape => ({
  detail: {
    done: progress.categorised,
    kind: "categorised",
    total: progress.categorisedTotal,
  },
  percent:
    progress.categorisedTotal > 0
      ? Math.min(
          PERCENT,
          Math.round(
            (progress.categorised / progress.categorisedTotal) * PERCENT
          )
        )
      : null,
  phase: "categorising",
});

const importingDetail = (progress: SyncProgress): SyncProgressDetail => {
  if (progress.transactionsImported > 0) {
    return { count: progress.transactionsImported, kind: "transactions" };
  }

  if (progress.accountsTotal > 0) {
    return {
      done: Math.min(progress.accountsDone + 1, progress.accountsTotal),
      kind: "accounts",
      total: progress.accountsTotal,
    };
  }

  return { kind: "starting" };
};

export const syncProgressShape = (
  progress: SyncProgress
): SyncProgressShape => {
  if (progress.phase === "categorising") {
    return categorisingShape(progress);
  }

  return {
    detail: importingDetail(progress),
    percent: null,
    phase: "importing",
  };
};
