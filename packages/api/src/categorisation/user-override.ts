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

export const lookupUserOverride = async (
  userId: string,
  merchantKey: string
): Promise<{
  category: SpendingCategory;
  merchantName: string | null;
} | null> => {
  const stored = await prisma.merchantOverride
    .findUnique({
      where: { userId_merchantKey: { merchantKey, userId } },
    })
    .then(Option.fromNullishOr, Option.none);

  return Option.match(stored, {
    onNone: () => null,
    onSome: (override) => {
      const category = resolveCategorySlug(override.category);

      return category === null
        ? null
        : { category, merchantName: override.merchantName };
    },
  });
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
