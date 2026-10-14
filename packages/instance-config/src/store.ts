import prisma from "@freenary/db";
import { Data, Effect, Result } from "effect";

import type { StoredSettings } from "./candidate";
import { seal, unseal } from "./seal";

export class InstanceStoreUnavailable extends Data.TaggedError(
  "InstanceStoreUnavailable"
)<{
  readonly operation: string;
  readonly detail: string;
}> {
  override get message(): string {
    return `The instance configuration could not be ${this.operation}: ${this.detail}`;
  }
}

const unavailable = (operation: string) => (cause: unknown) =>
  new InstanceStoreUnavailable({ detail: String(cause), operation });

export const readStoredSettings = Effect.fn("instanceConfig.readStored")(
  function* readStoredSettings(secret: string) {
    const rows = yield* Effect.tryPromise({
      catch: unavailable("read"),
      try: () =>
        prisma.instanceSetting.findMany({
          select: { key: true, sealed: true },
        }),
    });

    const opened: Record<string, string> = {};

    for (const row of rows) {
      const plaintext = unseal(secret, row.key, row.sealed);

      if (Result.isSuccess(plaintext)) {
        opened[row.key] = plaintext.success;
      } else {
        yield* Effect.logWarning(plaintext.failure.message);
      }
    }

    return opened satisfies StoredSettings;
  }
);

export const writeStoredSettings = Effect.fn("instanceConfig.writeStored")(
  function* writeStoredSettings(
    secret: string,
    entries: ReadonlyMap<string, string | null>,
    operatorId: string
  ) {
    const removed: string[] = [];
    const upserts: { key: string; sealed: string }[] = [];

    for (const [key, plaintext] of entries) {
      if (plaintext === null) {
        removed.push(key);
      } else {
        upserts.push({ key, sealed: seal(secret, key, plaintext) });
      }
    }

    yield* Effect.tryPromise({
      catch: unavailable("written"),
      try: () =>
        prisma.$transaction([
          prisma.instanceSetting.deleteMany({
            where: { key: { in: removed } },
          }),
          ...upserts.map((entry) =>
            prisma.instanceSetting.upsert({
              create: {
                key: entry.key,
                sealed: entry.sealed,
                updatedBy: operatorId,
              },
              update: { sealed: entry.sealed, updatedBy: operatorId },
              where: { key: entry.key },
            })
          ),
        ]),
    });
  }
);
