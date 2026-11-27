import prisma from "@freenary/db";
import type { Prisma, TransactionClient } from "@freenary/db";
import { Effect } from "effect";

import {
  CONFIRMED_PAIR_DATE_TOLERANCE_MS,
  matchInternalTransfersOrFail,
} from "../categorisation/internal-transfer";
import type { TransferStage } from "../categorisation/internal-transfer";
import { startPendingCategorisation } from "../categorisation/run";

const PAIRED_STAGE = "internal-transfer" satisfies TransferStage;

const RELEASED_TRANSFER = {
  exchangeFeeMinor: null,
  isInternalTransfer: false,
  resolutionConfidence: null,
  resolutionStage: null,
  resolvedCategory: null,
} as const satisfies Prisma.TransactionUpdateManyMutationInput;

const RELEASED_LEG_STATE = {
  exchangeFeeMinor: true,
  id: true,
  resolutionConfidence: true,
  resolvedCategory: true,
} as const satisfies Prisma.TransactionSelect;

interface ReleasedLeg {
  readonly exchangeFeeMinor: number | null;
  readonly id: string;
  readonly resolutionConfidence: number | null;
  readonly resolvedCategory: string | null;
}

export interface ReleasedTransfers {
  readonly legs: readonly ReleasedLeg[];
  readonly since: Date | null;
}

const NOTHING_RELEASED: ReleasedTransfers = { legs: [], since: null };

interface DateWindow {
  from: number;
  to: number;
}

const windowsAround = (dates: readonly Date[]): DateWindow[] => {
  const windows: DateWindow[] = [];
  const times = dates.map((date) => date.getTime()).toSorted((a, b) => a - b);

  for (const time of times) {
    const from = time - CONFIRMED_PAIR_DATE_TOLERANCE_MS;
    const to = time + CONFIRMED_PAIR_DATE_TOLERANCE_MS;
    const last = windows.at(-1);

    if (last && from <= last.to) {
      last.to = to;
    } else {
      windows.push({ from, to });
    }
  }

  return windows;
};

const within = (
  windows: readonly DateWindow[]
): Prisma.TransactionWhereInput[] =>
  windows.map(({ from, to }) => ({
    date: { gte: new Date(from), lte: new Date(to) },
  }));

type FoundLeg = ReleasedLeg & { readonly date: Date };

const keptPairedLegsAround = async (
  db: TransactionClient,
  userId: string,
  removed: Prisma.BankAccountWhereInput,
  removedDates: readonly Date[],
  found: readonly FoundLeg[]
): Promise<readonly FoundLeg[]> => {
  const legs = await db.transaction.findMany({
    select: { ...RELEASED_LEG_STATE, date: true },
    where: {
      OR: within(
        windowsAround([...removedDates, ...found.map(({ date }) => date)])
      ),
      account: { NOT: removed, connection: { userId } },
      categoryOverride: false,
      id: { notIn: found.map(({ id }) => id) },
      isInternalTransfer: true,
      resolutionStage: PAIRED_STAGE,
    },
  });

  return legs.length === 0
    ? found
    : keptPairedLegsAround(db, userId, removed, removedDates, [
        ...found,
        ...legs,
      ]);
};

export const releasePairedTransfers = async (
  db: TransactionClient,
  userId: string,
  removed: Prisma.BankAccountWhereInput
): Promise<ReleasedTransfers> => {
  const removedLegs = await db.transaction.findMany({
    select: { date: true },
    where: {
      account: { AND: [removed, { connection: { userId } }] },
      isInternalTransfer: true,
      resolutionStage: PAIRED_STAGE,
    },
  });

  if (removedLegs.length === 0) {
    return NOTHING_RELEASED;
  }

  const removedDates = removedLegs.map(({ date }) => date);
  const found = await keptPairedLegsAround(
    db,
    userId,
    removed,
    removedDates,
    []
  );

  const legs = found.map(({ date: _date, ...leg }) => leg);

  if (legs.length === 0) {
    return NOTHING_RELEASED;
  }

  await db.transaction.updateMany({
    data: RELEASED_TRANSFER,
    where: { id: { in: legs.map(({ id }) => id) } },
  });

  const [earliest] = windowsAround([
    ...removedDates,
    ...found.map(({ date }) => date),
  ]);

  return { legs, since: earliest ? new Date(earliest.from) : null };
};

const restoreReleasedTransfers = async (
  legs: readonly ReleasedLeg[]
): Promise<void> => {
  const byState = new Map<string, { ids: string[]; leg: ReleasedLeg }>();

  for (const leg of legs) {
    const key = JSON.stringify([
      leg.exchangeFeeMinor,
      leg.resolutionConfidence,
      leg.resolvedCategory,
    ]);

    const group = byState.get(key) ?? { ids: [], leg };

    group.ids.push(leg.id);
    byState.set(key, group);
  }

  await prisma.$transaction(
    [...byState.values()].map(({ ids, leg }) =>
      prisma.transaction.updateMany({
        data: {
          exchangeFeeMinor: leg.exchangeFeeMinor,
          isInternalTransfer: true,
          resolutionConfidence: leg.resolutionConfidence,
          resolutionStage: PAIRED_STAGE,
          resolvedCategory: leg.resolvedCategory,
        },
        where: {
          categoryOverride: false,
          id: { in: ids },
          isInternalTransfer: false,
          resolvedCategory: null,
        },
      })
    )
  );
};

interface Rematching {
  readonly categorise: (userId: string) => Promise<Date | null>;
  readonly match: (userId: string, since: Date | null) => Promise<number>;
}

export const rematchReleasedTransfersWith =
  ({ categorise, match }: Rematching) =>
  async (userId: string, { legs, since }: ReleasedTransfers): Promise<void> => {
    if (legs.length === 0) {
      return;
    }

    const rematched = await Effect.runPromise(
      Effect.tryPromise(() => match(userId, since)).pipe(
        Effect.matchEffect({
          onFailure: (cause) =>
            Effect.logWarning(
              "[bank-connection] Rematching released transfer legs failed; keeping them as transfers",
              cause
            ).pipe(
              Effect.andThen(
                Effect.tryPromise(() => restoreReleasedTransfers(legs))
              ),
              Effect.catchCause((restoreCause) =>
                Effect.logWarning(
                  "[bank-connection] Restoring released transfer legs failed",
                  restoreCause
                )
              ),
              Effect.as(false)
            ),
          onSuccess: () => Effect.succeed(true),
        })
      )
    );

    if (!rematched) {
      return;
    }

    await Effect.runPromise(
      Effect.tryPromise(() => categorise(userId)).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning(
            "[bank-connection] Categorising released transfer legs failed",
            cause
          )
        )
      )
    );
  };

export const rematchReleasedTransfers = rematchReleasedTransfersWith({
  categorise: startPendingCategorisation,
  match: matchInternalTransfersOrFail,
});
