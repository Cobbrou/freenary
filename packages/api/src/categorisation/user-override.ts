import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { Option } from "effect";

import { resolveCategorySlug } from "../lib/taxonomy";
import type { SpendingCategory } from "../lib/taxonomy";

type TransactionClient = Prisma.TransactionClient;

interface OverrideClient {
  merchantOverride: {
    deleteMany: (
      args: Prisma.MerchantOverrideDeleteManyArgs
    ) => PromiseLike<Prisma.BatchPayload>;
  };
  transaction: {
    updateMany: (
      args: Prisma.TransactionUpdateManyArgs
    ) => PromiseLike<Prisma.BatchPayload>;
  };
}

export interface UserOverride {
  category: SpendingCategory;
  merchantName: string | null;
}

export type UserOverrides = ReadonlyMap<string, UserOverride>;

export const userOverrideKey = (userId: string, merchantKey: string): string =>
  JSON.stringify([userId, merchantKey]);

export const loadUserOverrides = async (
  userIds: readonly string[]
): Promise<UserOverrides> => {
  const stored = await prisma.merchantOverride.findMany({
    select: {
      category: true,
      merchantKey: true,
      merchantName: true,
      userId: true,
    },
    where: { userId: { in: [...userIds] } },
  });

  return new Map(
    stored.flatMap((override) => {
      const category = resolveCategorySlug(override.category);

      return category === null
        ? []
        : [
            [
              userOverrideKey(override.userId, override.merchantKey),
              { category, merchantName: override.merchantName },
            ] as const,
          ];
    })
  );
};

export const upsertUserOverride = async (
  userId: string,
  merchantKey: string,
  category: SpendingCategory,
  merchantName: string | null | undefined,
  db: TransactionClient | undefined
): Promise<void> => {
  const client = db ?? prisma;
  const name = merchantName ?? null;

  await client.merchantOverride
    .upsert({
      create: { category, merchantKey, merchantName: name, userId },
      update: { category, merchantName: name },
      where: { userId_merchantKey: { merchantKey, userId } },
    })
    .then(Option.some, Option.none);
};

export const deleteUserOverride = async (
  userId: string,
  merchantKey: string,
  db: OverrideClient | undefined
): Promise<void> => {
  const client = db ?? prisma;

  await client.merchantOverride
    .deleteMany({
      where: { merchantKey, userId },
    })
    .then(Option.some, Option.none);

  await client.transaction.updateMany({
    data: {
      resolutionConfidence: null,
      resolutionStage: null,
      resolvedCategory: null,
    },
    where: {
      account: { connection: { userId } },
      categoryOverride: false,
      merchantKey,
      resolutionStage: "user-override",
    },
  });
};
