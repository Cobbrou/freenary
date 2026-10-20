import prisma from "@freenary/db";
import { Option } from "effect";

import type { Iso4217Currency } from "./types";

interface TransferCandidate {
  accountId: string;
  amount: number;
  currency: Iso4217Currency;
  date: Date;
  id: string;
}

const PAIR_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const MIN_ACCOUNTS_FOR_A_TRANSFER = 2;

const pairedLegIds = (
  candidates: readonly TransferCandidate[]
): Set<string> => {
  const paired = new Set<string>();
  const outgoingByAbsoluteAmount = new Map<number, TransferCandidate[]>();

  for (const tx of candidates) {
    if (tx.amount < 0) {
      const absoluteAmount = -tx.amount;
      const bucket = outgoingByAbsoluteAmount.get(absoluteAmount);

      if (bucket) {
        bucket.push(tx);
      } else {
        outgoingByAbsoluteAmount.set(absoluteAmount, [tx]);
      }
    }
  }

  for (const incoming of candidates) {
    if (incoming.amount <= 0 || paired.has(incoming.id)) {
      continue;
    }

    const sameAmountOutgoing = outgoingByAbsoluteAmount.get(incoming.amount);

    if (!sameAmountOutgoing) {
      continue;
    }

    for (const outgoing of sameAmountOutgoing) {
      const gapMs = Math.abs(incoming.date.getTime() - outgoing.date.getTime());
      const isOppositeLeg =
        !paired.has(outgoing.id) &&
        outgoing.accountId !== incoming.accountId &&
        outgoing.currency === incoming.currency &&
        gapMs <= PAIR_DATE_TOLERANCE_MS;

      if (isOppositeLeg) {
        paired.add(incoming.id);
        paired.add(outgoing.id);

        break;
      }
    }
  }

  return paired;
};

const matchInternal = async (userId: string): Promise<number> => {
  const accounts = await prisma.bankAccount.findMany({
    select: { id: true, identificationHash: true },
    where: {
      connection: { userId },
    },
  });

  if (accounts.length < MIN_ACCOUNTS_FOR_A_TRANSFER) {
    return 0;
  }

  const candidates = await prisma.transaction.findMany({
    orderBy: { date: "asc" },
    select: {
      accountId: true,
      amount: true,
      currency: true,
      date: true,
      id: true,
    },
    where: {
      accountId: { in: accounts.map((account) => account.id) },
      categoryOverride: false,
      isInternalTransfer: false,
    },
  });

  if (candidates.length === 0) {
    return 0;
  }

  const paired = pairedLegIds(candidates);

  if (paired.size === 0) {
    return 0;
  }

  const { count } = await prisma.transaction.updateMany({
    data: { isInternalTransfer: true },
    where: { id: { in: [...paired] } },
  });

  return count;
};

export const matchInternalTransfers = async (userId: string): Promise<number> =>
  Option.getOrElse(
    await matchInternal(userId).then(Option.some, Option.none),
    () => 0
  );
