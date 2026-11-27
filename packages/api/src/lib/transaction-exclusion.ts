import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";

import { EXCLUSION_OF_SCOPE, exclusionReasonOf } from "./exclusion-scope";
import type { ExclusionScope, TransactionExclusion } from "./exclusion-scope";

export const exclusionAfter = (
  current: TransactionExclusion | null,
  scope: ExclusionScope,
  isExcluded: boolean,
  fallback: TransactionExclusion | null = null
): TransactionExclusion | null => {
  const exclusion = EXCLUSION_OF_SCOPE[scope];

  if (isExcluded) {
    return current ?? exclusion;
  }

  return current === exclusion ? fallback : current;
};

export const inheritedExclusionOf = ({
  accountExcluded,
  merchantExcluded,
}: {
  accountExcluded: boolean;
  merchantExcluded: boolean;
}): TransactionExclusion | null => {
  if (accountExcluded) {
    return "ACCOUNT";
  }

  return merchantExcluded ? "MERCHANT" : null;
};

export const displayedReasonOf = ({
  accountReason,
  exclusion,
  merchantReason,
  transactionReason,
}: {
  accountReason: string | null;
  exclusion: TransactionExclusion | null;
  merchantReason: string | null;
  transactionReason: string | null;
}): string | null => {
  if (exclusion === "ACCOUNT") {
    return accountReason;
  }

  if (exclusion === "MERCHANT") {
    return merchantReason;
  }

  return exclusion === "TRANSACTION" ? transactionReason : null;
};

interface ExclusionOutcome {
  exclusion: TransactionExclusion | null;
  exclusionReason: string | null;
  updated: number;
}

interface ExclusionChange {
  isExcluded: boolean;
  reason?: string | null;
}

const reasonAfter = (
  isExcluded: boolean,
  reason: string | null | undefined
): string | null | undefined => {
  if (!isExcluded) {
    return null;
  }

  return reason === undefined ? undefined : exclusionReasonOf(reason);
};

const keptReason = (
  change: string | null | undefined,
  stored: string | null
): string | null => (change === undefined ? stored : change);

const releasedTo = (
  userId: string,
  where: Prisma.TransactionWhereInput,
  from: TransactionExclusion
) =>
  [true, false].map((excluded) =>
    prisma.transaction.updateMany({
      data: { exclusion: excluded ? "ACCOUNT" : null },
      where: {
        ...where,
        account: { connection: { userId }, excluded },
        exclusion: from,
      },
    })
  );

const excludedMerchantKeys = async (userId: string) => {
  const merchants = await prisma.excludedMerchant.findMany({
    select: { merchantKey: true },
    where: { userId },
  });

  return merchants.map(({ merchantKey }) => merchantKey);
};

const ownedTransaction = (userId: string, transactionId: string) =>
  prisma.transaction.findFirst({
    select: {
      account: { select: { excluded: true, exclusionReason: true } },
      counterpartyName: true,
      exclusion: true,
      exclusionReason: true,
      merchantKey: true,
      normalisedDescriptor: true,
    },
    where: { account: { connection: { userId } }, id: transactionId },
  });

const merchantExclusionOf = async (
  userId: string,
  merchantKey: string | null
) =>
  merchantKey
    ? await prisma.excludedMerchant.findUnique({
        select: { reason: true },
        where: { userId_merchantKey: { merchantKey, userId } },
      })
    : null;

export const excludeTransaction = async (
  userId: string,
  transactionId: string,
  { isExcluded, reason }: ExclusionChange
): Promise<ExclusionOutcome | null> => {
  const tx = await ownedTransaction(userId, transactionId);

  if (!tx) {
    return null;
  }

  const merchant = await merchantExclusionOf(userId, tx.merchantKey);
  const exclusion = exclusionAfter(
    tx.exclusion,
    "transaction",
    isExcluded,
    inheritedExclusionOf({
      accountExcluded: tx.account.excluded,
      merchantExcluded: merchant !== null,
    })
  );

  const exclusionReason =
    exclusion === "TRANSACTION"
      ? keptReason(reasonAfter(isExcluded, reason), tx.exclusionReason)
      : null;

  const reasonOf = (excludedBy: TransactionExclusion | null) =>
    displayedReasonOf({
      accountReason: tx.account.exclusionReason,
      exclusion: excludedBy,
      merchantReason: merchant?.reason ?? null,
      transactionReason: exclusionReason,
    });

  if (exclusion === tx.exclusion && exclusionReason === tx.exclusionReason) {
    return { exclusion, exclusionReason: reasonOf(exclusion), updated: 0 };
  }

  await prisma.transaction.update({
    data: { exclusion, exclusionReason },
    where: { id: transactionId },
  });

  return { exclusion, exclusionReason: reasonOf(exclusion), updated: 1 };
};

export const applyAccountExclusions = async (userId: string) => {
  await prisma.$transaction([
    prisma.transaction.updateMany({
      data: { exclusion: null },
      where: {
        account: { connection: { userId }, excluded: false },
        exclusion: "ACCOUNT",
      },
    }),
    prisma.transaction.updateMany({
      data: { exclusion: "ACCOUNT" },
      where: {
        OR: [{ exclusion: null }, { exclusion: "MERCHANT" }],
        account: { connection: { userId }, excluded: true },
      },
    }),
  ]);
};

export const applyMerchantExclusions = async (userId: string) => {
  const keys = await excludedMerchantKeys(userId);

  await prisma.$transaction([
    ...releasedTo(
      userId,
      { OR: [{ merchantKey: null }, { merchantKey: { notIn: keys } }] },
      "MERCHANT"
    ),
    prisma.transaction.updateMany({
      data: { exclusion: "MERCHANT" },
      where: {
        account: { connection: { userId } },
        exclusion: null,
        merchantKey: { in: keys },
      },
    }),
  ]);
};

export const applyExclusions = async (userId: string) => {
  await applyAccountExclusions(userId);
  await applyMerchantExclusions(userId);
};

const sumOf = (updates: readonly { count: number }[]) =>
  updates.reduce((sum, update) => sum + update.count, 0);

const keepMerchantExcluded = async (
  tx: { counterpartyName: string | null; normalisedDescriptor: string | null },
  merchantKey: string,
  userId: string,
  reason: string | null | undefined
) => {
  const reasonChange = reasonAfter(true, reason);

  const [merchant, { count }] = await prisma.$transaction([
    prisma.excludedMerchant.upsert({
      create: {
        merchantKey,
        merchantName: tx.counterpartyName ?? tx.normalisedDescriptor,
        reason: reasonChange ?? null,
        userId,
      },
      update: reasonChange === undefined ? {} : { reason: reasonChange },
      where: { userId_merchantKey: { merchantKey, userId } },
    }),
    prisma.transaction.updateMany({
      data: { exclusion: "MERCHANT" },
      where: {
        account: { connection: { userId } },
        exclusion: null,
        merchantKey,
      },
    }),
  ]);

  return { count, merchantReason: merchant.reason };
};

const includeMerchant = async (merchantKey: string, userId: string) => {
  const [, ...updates] = await prisma.$transaction([
    prisma.excludedMerchant.deleteMany({ where: { merchantKey, userId } }),
    ...releasedTo(userId, { merchantKey }, "MERCHANT"),
  ]);

  return { count: sumOf(updates), merchantReason: null };
};

export const excludeMerchant = async (
  userId: string,
  transactionId: string,
  { isExcluded, reason }: ExclusionChange
): Promise<ExclusionOutcome | null> => {
  const tx = await ownedTransaction(userId, transactionId);

  if (!tx) {
    return null;
  }

  const { merchantKey } = tx;

  if (!merchantKey) {
    return {
      exclusion: tx.exclusion,
      exclusionReason: tx.exclusionReason,
      updated: 0,
    };
  }

  const { count, merchantReason } = isExcluded
    ? await keepMerchantExcluded(tx, merchantKey, userId, reason)
    : await includeMerchant(merchantKey, userId);

  const exclusion = exclusionAfter(
    tx.exclusion,
    "merchant",
    isExcluded,
    inheritedExclusionOf({
      accountExcluded: tx.account.excluded,
      merchantExcluded: false,
    })
  );

  return {
    exclusion,
    exclusionReason: displayedReasonOf({
      accountReason: tx.account.exclusionReason,
      exclusion,
      merchantReason,
      transactionReason: tx.exclusionReason,
    }),
    updated: count,
  };
};

export const excludeAccount = async (
  userId: string,
  accountId: string,
  { isExcluded, reason }: ExclusionChange
) => {
  const ownAccount = { connection: { userId }, id: accountId };
  const account = await prisma.bankAccount.findFirst({
    select: { excluded: true, exclusionReason: true },
    where: ownAccount,
  });

  if (!account) {
    return null;
  }

  const exclusionReason = keptReason(
    reasonAfter(isExcluded, reason),
    account.exclusionReason
  );

  const keys = isExcluded ? [] : await excludedMerchantKeys(userId);

  const [, ...updates] = await prisma.$transaction([
    prisma.bankAccount.update({
      data: { excluded: isExcluded, exclusionReason },
      where: { id: accountId },
    }),
    ...(isExcluded
      ? [
          prisma.transaction.updateMany({
            data: { exclusion: "ACCOUNT" },
            where: {
              OR: [{ exclusion: null }, { exclusion: "MERCHANT" }],
              account: ownAccount,
            },
          }),
        ]
      : [
          prisma.transaction.updateMany({
            data: { exclusion: "MERCHANT" },
            where: {
              account: ownAccount,
              exclusion: "ACCOUNT",
              merchantKey: { in: keys },
            },
          }),
          prisma.transaction.updateMany({
            data: { exclusion: null },
            where: { account: ownAccount, exclusion: "ACCOUNT" },
          }),
        ]),
  ]);

  return {
    changed: account.excluded !== isExcluded,
    excluded: isExcluded,
    exclusionReason,
    updated: sumOf(updates),
  };
};

interface ExcludableRow {
  account: { exclusionReason: string | null };
  exclusion: TransactionExclusion | null;
  exclusionReason: string | null;
  id: string;
  merchantKey: string | null;
}

export const exclusionReasonsOf = async (
  userId: string,
  rows: readonly ExcludableRow[]
): Promise<Map<string, string | null>> => {
  const merchantKeys = [
    ...new Set(
      rows.flatMap((row) =>
        row.exclusion === "MERCHANT" && row.merchantKey ? [row.merchantKey] : []
      )
    ),
  ];

  const merchants =
    merchantKeys.length === 0
      ? []
      : await prisma.excludedMerchant.findMany({
          select: { merchantKey: true, reason: true },
          where: { merchantKey: { in: merchantKeys }, userId },
        });

  const merchantReasons = new Map(
    merchants.map((merchant) => [merchant.merchantKey, merchant.reason])
  );

  return new Map(
    rows.map((row) => [
      row.id,
      displayedReasonOf({
        accountReason: row.account.exclusionReason,
        exclusion: row.exclusion,
        merchantReason: merchantReasons.get(row.merchantKey ?? "") ?? null,
        transactionReason: row.exclusionReason,
      }),
    ])
  );
};
