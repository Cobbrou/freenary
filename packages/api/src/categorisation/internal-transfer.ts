import prisma from "@freenary/db";
import { Option } from "effect";

import type { RateBook } from "../fx/rate-book";
import { loadRateBook } from "../fx/rates";
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
  originalAmount?: number | null;
  originalCurrency?: string | null;
}

const PAIR_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export const CROSS_CURRENCY_TOLERANCE = 0.03;

export interface TransferPair {
  exchangeFeeMinor?: number | null;
  incoming: TransferCandidate;
  outgoing: TransferCandidate;
}

export interface TransferLegUpdates {
  fees: Map<string, number>;
  flagged: string[];
  saved: Map<SavingCategory, string[]>;
}

const withinWindow = (a: TransferCandidate, b: TransferCandidate) =>
  Math.abs(a.date.getTime() - b.date.getTime()) <= PAIR_DATE_TOLERANCE_MS;

const bankRateMatches = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate
): boolean => {
  const outgoingMadeIn =
    outgoing.originalCurrency === incoming.currency &&
    Math.abs(outgoing.originalAmount ?? 0) === incoming.amount;

  const incomingMadeIn =
    incoming.originalCurrency === outgoing.currency &&
    Math.abs(incoming.originalAmount ?? 0) === Math.abs(outgoing.amount);

  return outgoingMadeIn || incomingMadeIn;
};

const referenceGap = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate,
  rates: RateBook
): number | null => {
  const expected = rates.convert(
    Math.abs(outgoing.amount),
    outgoing.currency,
    incoming.currency,
    outgoing.date
  );

  if (expected === null || expected <= 0) {
    return null;
  }

  return Math.abs(expected - incoming.amount) / expected;
};

export const exchangeFeeOf = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate,
  rates: RateBook
): number | null => {
  const received = rates.convert(
    incoming.amount,
    incoming.currency,
    outgoing.currency,
    incoming.date
  );

  return received === null
    ? null
    : Math.max(0, Math.abs(outgoing.amount) - received);
};

const crossCurrencyPairs = (
  candidates: readonly TransferCandidate[],
  paired: Set<string>,
  rates: RateBook
): TransferPair[] => {
  const pairs: TransferPair[] = [];
  const outgoing = candidates.filter(
    (tx) => tx.amount < 0 && !paired.has(tx.id)
  );

  for (const incoming of candidates) {
    if (incoming.amount <= 0 || paired.has(incoming.id)) {
      continue;
    }

    let best: { gap: number; leg: TransferCandidate } | null = null;

    for (const candidate of outgoing) {
      const isOpposite =
        !paired.has(candidate.id) &&
        candidate.currency !== incoming.currency &&
        withinWindow(candidate, incoming);

      if (isOpposite) {
        const gap = bankRateMatches(candidate, incoming)
          ? 0
          : referenceGap(candidate, incoming, rates);

        const isCloser =
          gap !== null &&
          gap <= CROSS_CURRENCY_TOLERANCE &&
          (best === null || gap < best.gap);

        if (isCloser) {
          best = { gap, leg: candidate };
        }
      }
    }

    if (best) {
      paired.add(incoming.id);
      paired.add(best.leg.id);
      pairs.push({
        exchangeFeeMinor: exchangeFeeOf(best.leg, incoming, rates),
        incoming,
        outgoing: best.leg,
      });
    }
  }

  return pairs;
};

export const pairedLegs = (
  candidates: readonly TransferCandidate[],
  rates: RateBook | null = null
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

  const currencies = new Set(candidates.map((tx) => tx.currency));

  return rates && currencies.size > 1
    ? [...pairs, ...crossCurrencyPairs(candidates, paired, rates)]
    : pairs;
};

export const transferLegUpdates = (
  pairs: readonly TransferPair[],
  accountTypeOf: ReadonlyMap<string, string>
): TransferLegUpdates => {
  const flagged: string[] = [];
  const saved = new Map<SavingCategory, string[]>();
  const fees = new Map<string, number>();

  for (const { exchangeFeeMinor, incoming, outgoing } of pairs) {
    flagged.push(incoming.id, outgoing.id);

    if (exchangeFeeMinor) {
      fees.set(outgoing.id, exchangeFeeMinor);
    }

    const from = accountTypeRule(accountTypeOf.get(outgoing.accountId) ?? "");
    const into = accountTypeRule(accountTypeOf.get(incoming.accountId) ?? "");

    if (from.countsInCashFlow && into.savingCategory !== null) {
      const ids = saved.get(into.savingCategory) ?? [];

      ids.push(outgoing.id);
      saved.set(into.savingCategory, ids);
    }
  }

  return { fees, flagged, saved };
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

  if (accounts.length === 0) {
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
      originalAmount: true,
      originalCurrency: true,
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

  const [first] = candidates;
  const last = candidates.at(-1);

  if (!(first && last)) {
    return 0;
  }

  const rates = await loadRateBook(
    [...new Set(candidates.map((tx) => tx.currency))],
    first.date,
    last.date
  );

  const { fees, flagged, saved } = transferLegUpdates(
    pairedLegs(candidates, rates),
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
    ...[...fees].map(([id, exchangeFeeMinor]) =>
      prisma.transaction.update({
        data: { exchangeFeeMinor },
        where: { id },
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
