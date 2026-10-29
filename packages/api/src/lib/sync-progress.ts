import prisma, { Prisma } from "@freenary/db";
import { Option } from "effect";

export type SyncProgressPhase = "categorising" | "importing";

export interface SyncProgress {
  phase: SyncProgressPhase;
  startedAt: Date;
  accountsDone: number;
  accountsTotal: number;
  transactionsImported: number;
  categorised: number;
  categorisedTotal: number;
}

export interface SyncRunRow {
  phase: "CATEGORISING" | "FINISHED" | "IMPORTING";
  startedAt: Date;
  updatedAt: Date;
  accountsDone: number;
  accountsTotal: number;
  transactionsImported: number;
  categorised: number;
  categorisedTotal: number;
}

export interface SyncRunOutcomeRow extends SyncRunRow {
  failures: Prisma.JsonValue;
}

export interface SyncOutcome {
  categorised: number;
  failures: Prisma.JsonValue;
}

export interface SyncReporter {
  accountsDiscovered: (count: number) => Promise<void>;
  transactionsImported: (count: number) => Promise<void>;
  accountFinished: () => Promise<void>;
  categorisingStarted: (total: number) => Promise<void>;
  categorised: (count: number) => Promise<void>;
  heartbeat: () => Promise<void>;
  finished: () => Promise<void>;
  finishedWith: (outcome: {
    categorised: number;
    failures: unknown[];
  }) => Promise<void>;
}

interface ReporterState {
  phase: "CATEGORISING" | "FINISHED" | "IMPORTING";
  accountsDone: number;
  accountsTotal: number;
  transactionsImported: number;
  categorised: number;
  categorisedTotal: number;
  failures: Prisma.InputJsonValue | undefined;
  lastWriteAt: number;
}

export const SYNC_RUN_ABANDONED_AFTER_MS = 5 * 60 * 1000;

const PROGRESS_WRITE_INTERVAL_MS = 1000;

export const syncProgressFrom = (
  row: SyncRunRow | null,
  now: Date
): SyncProgress | null => {
  if (row === null || row.phase === "FINISHED") {
    return null;
  }

  const silentFor = now.getTime() - row.updatedAt.getTime();

  if (silentFor >= SYNC_RUN_ABANDONED_AFTER_MS) {
    return null;
  }

  return {
    accountsDone: row.accountsDone,
    accountsTotal: row.accountsTotal,
    categorised: row.categorised,
    categorisedTotal: row.categorisedTotal,
    phase: row.phase === "IMPORTING" ? "importing" : "categorising",
    startedAt: row.startedAt,
    transactionsImported: row.transactionsImported,
  };
};

export const syncOutcomeFrom = (
  row: SyncRunOutcomeRow | null,
  startedAt: Date,
  now: Date
): SyncOutcome | "lost" | "running" => {
  if (row === null || row.startedAt.getTime() !== startedAt.getTime()) {
    return "lost";
  }

  if (row.phase !== "FINISHED") {
    return syncProgressFrom(row, now) === null ? "lost" : "running";
  }

  return row.failures === null
    ? "lost"
    : { categorised: row.categorised, failures: row.failures };
};

export const readSyncOutcome = async (
  userId: string,
  startedAt: Date
): Promise<SyncOutcome | "lost" | "running"> => {
  const row = await prisma.syncRun.findUnique({ where: { userId } });

  return syncOutcomeFrom(row, startedAt, new Date());
};

export const readSyncProgress = async (
  userId: string
): Promise<SyncProgress | null> =>
  syncProgressFrom(
    await prisma.syncRun.findUnique({ where: { userId } }),
    new Date()
  );

export const claimSyncRun = async (
  userId: string,
  phase: "CATEGORISING" | "IMPORTING"
): Promise<Date | null> => {
  const now = new Date();
  const abandonedBefore = new Date(now.getTime() - SYNC_RUN_ABANDONED_AFTER_MS);
  const fresh = {
    accountsDone: 0,
    accountsTotal: 0,
    categorised: 0,
    categorisedTotal: 0,
    failures: Prisma.DbNull,
    finishedAt: null,
    phase,
    startedAt: now,
    transactionsImported: 0,
  };

  const reclaimed = await prisma.syncRun.updateMany({
    data: fresh,
    where: {
      OR: [{ phase: "FINISHED" }, { updatedAt: { lt: abandonedBefore } }],
      userId,
    },
  });

  if (reclaimed.count > 0) {
    return now;
  }

  const created = await prisma.syncRun.createMany({
    data: { ...fresh, userId },
    skipDuplicates: true,
  });

  return created.count > 0 ? now : null;
};

export const createSyncReporter = (
  userId: string,
  phase: "CATEGORISING" | "IMPORTING",
  claimedAt: Date
): SyncReporter => {
  const state: ReporterState = {
    accountsDone: 0,
    accountsTotal: 0,
    categorised: 0,
    categorisedTotal: 0,
    failures: undefined,
    lastWriteAt: 0,
    phase,
    transactionsImported: 0,
  };

  const write = async (immediately: boolean): Promise<void> => {
    const now = Date.now();
    const isThrottled =
      !immediately && now - state.lastWriteAt < PROGRESS_WRITE_INTERVAL_MS;

    if (isThrottled) {
      return;
    }

    state.lastWriteAt = now;

    await prisma.syncRun
      .updateMany({
        data: {
          accountsDone: state.accountsDone,
          accountsTotal: state.accountsTotal,
          categorised: state.categorised,
          categorisedTotal: state.categorisedTotal,
          failures: state.failures,
          finishedAt: state.phase === "FINISHED" ? new Date(now) : null,
          phase: state.phase,
          transactionsImported: state.transactionsImported,
        },
        where: { startedAt: claimedAt, userId },
      })
      .then(Option.some, Option.none);
  };

  return {
    accountFinished: () => {
      state.accountsDone += 1;

      return write(true);
    },
    accountsDiscovered: (count) => {
      state.accountsTotal += count;

      return write(true);
    },
    categorised: (count) => {
      state.categorised += count;

      return write(false);
    },
    categorisingStarted: (total) => {
      state.phase = "CATEGORISING";
      state.categorisedTotal = total;

      return write(true);
    },
    finished: () => {
      state.phase = "FINISHED";

      return write(true);
    },
    finishedWith: (outcome) => {
      state.phase = "FINISHED";
      state.categorised = outcome.categorised;
      // SAFETY: the failures are plain objects of strings, as JSON as it gets.
      state.failures = outcome.failures as Prisma.InputJsonValue;

      return write(true);
    },
    heartbeat: () => write(false),
    transactionsImported: (count) => {
      state.transactionsImported += count;

      return write(false);
    },
  };
};
