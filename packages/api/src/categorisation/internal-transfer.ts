import prisma from "@freenary/db";
import { Option } from "effect";

import type { SavingCategory } from "../lib/account-types";
import {
  accountTypeRule,
  INTERNAL_TRANSFER_ACCOUNT_TYPES,
} from "../lib/account-types";
import type { Iso4217Currency } from "./types";

export interface TransferCandidate {
  accountId: string;
  amount: number;
  currency: Iso4217Currency;
  date: Date;
  id: string;
}

const PAIR_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const MIN_ACCOUNTS_FOR_A_TRANSFER = 2;

export interface TransferPair {
  incoming: TransferCandidate;
  outgoing: TransferCandidate;
}

export interface TransferLegUpdates {
  flagged: string[];
  saved: Map<SavingCategory, string[]>;
}

export const pairedLegs = (
  candidates: readonly TransferCandidate[]
): TransferPair[] => {
  const pairs: TransferPair[] = [];
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
        pairs.push({ incoming, outgoing });

        break;
      }
    }
  }

  return pairs;
};

export const transferLegUpdates = (
  pairs: readonly TransferPair[],
  accountTypeOf: ReadonlyMap<string, string>
): TransferLegUpdates => {
  const flagged: string[] = [];
  const saved = new Map<SavingCategory, string[]>();

  for (const { incoming, outgoing } of pairs) {
    flagged.push(incoming.id, outgoing.id);

    const from = accountTypeRule(accountTypeOf.get(outgoing.accountId) ?? "");
    const into = accountTypeRule(accountTypeOf.get(incoming.accountId) ?? "");

    if (from.countsInCashFlow && into.savingCategory !== null) {
      const ids = saved.get(into.savingCategory) ?? [];

      ids.push(outgoing.id);
      saved.set(into.savingCategory, ids);
    }
  }

  return { flagged, saved };
};

const matchInternal = async (
  userId: string,
  bookedSince: Date | null
): Promise<number> => {
  const accounts = await prisma.bankAccount.findMany({
    select: { id: true, type: true },
    where: {
      connection: { userId },
      type: { in: INTERNAL_TRANSFER_ACCOUNT_TYPES },
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
      date:
        bookedSince === null
          ? undefined
          : { gte: new Date(bookedSince.getTime() - PAIR_DATE_TOLERANCE_MS) },
      isInternalTransfer: false,
    },
  });

  if (candidates.length === 0) {
    return 0;
  }

  const { flagged, saved } = transferLegUpdates(
    pairedLegs(candidates),
    new Map(accounts.map((account) => [account.id, account.type]))
  );

  if (flagged.length === 0) {
    return 0;
  }

  const [{ count }] = await prisma.$transaction([
    prisma.transaction.updateMany({
      data: { isInternalTransfer: true },
      where: { id: { in: flagged } },
    }),
    ...[...saved].map(([category, ids]) =>
      prisma.transaction.updateMany({
        data: {
          resolutionConfidence: 1,
          resolutionStage: "internal-transfer",
          resolvedCategory: category,
        },
        where: { id: { in: ids } },
      })
    ),
  ]);

  return count;
};

export const matchInternalTransfers = async (
  userId: string,
  bookedSince: Date | null
): Promise<number> =>
  Option.getOrElse(
    await matchInternal(userId, bookedSince)
      .then(Option.some)
      .catch((error) => {
        console.warn(
          "[categorisation] Matching internal transfers failed",
          error
        );

        return Option.none();
      }),
    () => 0
  );
