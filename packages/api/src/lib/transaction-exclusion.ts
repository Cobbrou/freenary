import prisma from "@freenary/db";

import { EXCLUSION_OF_SCOPE } from "./exclusion-scope";
import type { ExclusionScope, TransactionExclusion } from "./exclusion-scope";

export const exclusionAfter = (
  current: TransactionExclusion | null,
  scope: ExclusionScope,
  isExcluded: boolean
): TransactionExclusion | null => {
  const exclusion = EXCLUSION_OF_SCOPE[scope];

  if (isExcluded) {
    return current ?? exclusion;
  }

  return current === exclusion ? null : current;
};

interface ExclusionOutcome {
  exclusion: TransactionExclusion | null;
  updated: number;
}

const ownedTransaction = (userId: string, transactionId: string) =>
  prisma.transaction.findFirst({
    select: {
      counterpartyName: true,
      exclusion: true,
      merchantKey: true,
      normalisedDescriptor: true,
    },
    where: { account: { connection: { userId } }, id: transactionId },
  });

export const excludeTransaction = async (
  userId: string,
  transactionId: string,
  isExcluded: boolean
): Promise<ExclusionOutcome | null> => {
  const tx = await ownedTransaction(userId, transactionId);

  if (!tx) {
    return null;
  }

  const exclusion = exclusionAfter(tx.exclusion, "transaction", isExcluded);

  if (exclusion === tx.exclusion) {
    return { exclusion, updated: 0 };
  }

  await prisma.transaction.update({
    data: { exclusion },
    where: { id: transactionId },
  });

  return { exclusion, updated: 1 };
};

export const excludeMerchant = async (
  userId: string,
  transactionId: string,
  isExcluded: boolean
): Promise<ExclusionOutcome | null> => {
  const tx = await ownedTransaction(userId, transactionId);

  if (!tx) {
    return null;
  }

  const { merchantKey } = tx;

  if (!merchantKey) {
    return { exclusion: tx.exclusion, updated: 0 };
  }

  const merchantTransactions = {
    account: { connection: { userId } },
    merchantKey,
  };

  const [, { count }] = await prisma.$transaction(
    isExcluded
      ? [
          prisma.excludedMerchant.createMany({
            data: {
              merchantKey,
              merchantName: tx.counterpartyName ?? tx.normalisedDescriptor,
              userId,
            },
            skipDuplicates: true,
          }),
          prisma.transaction.updateMany({
            data: { exclusion: "MERCHANT" },
            where: { ...merchantTransactions, exclusion: null },
          }),
        ]
      : [
          prisma.excludedMerchant.deleteMany({
            where: { merchantKey, userId },
          }),
          prisma.transaction.updateMany({
            data: { exclusion: null },
            where: { ...merchantTransactions, exclusion: "MERCHANT" },
          }),
        ]
  );

  return {
    exclusion: exclusionAfter(tx.exclusion, "merchant", isExcluded),
    updated: count,
  };
};

export const applyMerchantExclusions = async (userId: string) => {
  const excluded = await prisma.excludedMerchant.findMany({
    select: { merchantKey: true },
    where: { userId },
  });

  const keys = excluded.map(({ merchantKey }) => merchantKey);
  const ownTransactions = { account: { connection: { userId } } };

  const clearReleased = prisma.transaction.updateMany({
    data: { exclusion: null },
    where: {
      ...ownTransactions,
      OR: [{ merchantKey: null }, { merchantKey: { notIn: keys } }],
      exclusion: "MERCHANT",
    },
  });

  if (keys.length === 0) {
    await clearReleased;

    return;
  }

  await prisma.$transaction([
    clearReleased,
    prisma.transaction.updateMany({
      data: { exclusion: "MERCHANT" },
      where: {
        ...ownTransactions,
        exclusion: null,
        merchantKey: { in: keys },
      },
    }),
  ]);
};
