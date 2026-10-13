import prisma from "@freenary/db";
import { Effect } from "effect";

const SETUP_ROW_ID = "singleton";
const OPERATOR_ROLE = "OPERATOR";

export interface SetupState {
  readonly claimed: boolean;
  readonly completed: boolean;
}

export const readSetupState = Effect.fn("instanceConfig.readSetupState")(
  function* readSetupState() {
    const row = yield* Effect.promise(() =>
      prisma.instanceSetup.findUnique({
        select: { claimedAt: true, completedAt: true },
        where: { id: SETUP_ROW_ID },
      })
    );

    return {
      claimed: (row?.claimedAt ?? null) !== null,
      completed: (row?.completedAt ?? null) !== null,
    } satisfies SetupState;
  }
);

export const claimForFirstSession = Effect.fn(
  "instanceConfig.claimForFirstSession"
)(function* claimForFirstSession(userId: string) {
  const { claimed } = yield* readSetupState();

  if (claimed) {
    return false;
  }

  return yield* Effect.promise(() =>
    prisma.$transaction(async (tx) => {
      await tx.instanceSetup.upsert({
        create: { id: SETUP_ROW_ID },
        update: {},
        where: { id: SETUP_ROW_ID },
      });

      const taken = await tx.instanceSetup.updateMany({
        data: { claimedAt: new Date() },
        where: { claimedAt: null, id: SETUP_ROW_ID },
      });

      if (taken.count === 0) {
        return false;
      }

      await tx.user.update({
        data: { role: OPERATOR_ROLE },
        where: { id: userId },
      });

      return true;
    })
  );
});

export const markSetupComplete = Effect.fn("instanceConfig.markSetupComplete")(
  function* markSetupComplete() {
    yield* Effect.promise(() =>
      prisma.instanceSetup.updateMany({
        data: { completedAt: new Date() },
        where: { completedAt: null, id: SETUP_ROW_ID },
      })
    );
  }
);
