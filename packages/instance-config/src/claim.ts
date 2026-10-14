import prisma from "@freenary/db";
import { Data, Effect } from "effect";

const SETUP_ROW_ID = "singleton";
const OPERATOR_ROLE = "OPERATOR";

export class InstanceSetupUnavailable extends Data.TaggedError(
  "InstanceSetupUnavailable"
)<{
  readonly operation: string;
  readonly detail: string;
}> {
  override get message(): string {
    return `The instance setup could not be ${this.operation}: ${this.detail}`;
  }
}

const unavailable = (operation: string) => (cause: unknown) =>
  new InstanceSetupUnavailable({ detail: String(cause), operation });

export interface SetupState {
  readonly claimed: boolean;
  readonly completed: boolean;
}

export const readSetupState = Effect.fn("instanceConfig.readSetupState")(
  function* readSetupState() {
    const row = yield* Effect.tryPromise({
      catch: unavailable("read"),
      try: () =>
        prisma.instanceSetup.findUnique({
          select: { claimedAt: true, completedAt: true },
          where: { id: SETUP_ROW_ID },
        }),
    });

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

  return yield* Effect.tryPromise({
    catch: unavailable("claimed"),
    try: () =>
      prisma.$transaction(async (tx) => {
        await tx.instanceSetup.createMany({
          data: [{ id: SETUP_ROW_ID }],
          skipDuplicates: true,
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
      }),
  });
});

export const markSetupComplete = Effect.fn("instanceConfig.markSetupComplete")(
  function* markSetupComplete() {
    yield* Effect.tryPromise({
      catch: unavailable("completed"),
      try: () =>
        prisma.instanceSetup.updateMany({
          data: { completedAt: new Date() },
          where: { completedAt: null, id: SETUP_ROW_ID },
        }),
    });
  }
);
