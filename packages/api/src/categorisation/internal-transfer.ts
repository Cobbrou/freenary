import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { Option } from "effect";

import type { RateBook } from "../fx/rate-book";
import { loadRateBook } from "../fx/rates";
import type { SavingCategory } from "../lib/account-types";
import {
  accountTypeRule,
  INTERNAL_TRANSFER_ACCOUNT_TYPES,
} from "../lib/account-types";
import { INTERNAL_TRANSFER_CATEGORY } from "../lib/taxonomy";
import {
  ibanKeyOf,
  isDeclaredOwn,
  isOwnerNameKey,
  loadOwnCounterparties,
  namesOwnerOf,
  OWN_COUNTERPARTY_STAGE,
  ownerNameKeyOf,
  rememberOwnerNames,
  TRANSFER_CHANNELS,
} from "./own-counterparty";
import type { OwnCounterparties } from "./own-counterparty";
import type { Iso4217Currency, ResolutionStage } from "./types";

export interface TransferCandidate {
  accountIban?: string | null;
  accountId: string;
  amount: number;
  channel?: string | null;
  counterpartyIban?: string | null;
  counterpartyNameKey?: string | null;
  currency: Iso4217Currency;
  date: Date;
  fundedByHolder?: boolean;
  id: string;
  merchantKey?: string | null;
  namesOwner?: boolean | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PAIR_DATE_TOLERANCE_MS = DAY_MS;

const CONFIRMED_PAIR_DATE_TOLERANCE_MS = 4 * DAY_MS;

export const CROSS_CURRENCY_TOLERANCE = 0.03;

export type PairEvidence = "confirmed" | "destination" | "named" | "unknown";

export interface TransferPair {
  evidence?: PairEvidence;
  exchangeFeeMinor?: number | null;
  incoming: TransferCandidate;
  outgoing: TransferCandidate;
}

export interface OwnAccountLeg {
  leg: TransferCandidate;
  otherAccountId: string | null;
}

export type TransferStage = Extract<
  ResolutionStage,
  "internal-transfer" | "own-counterparty"
>;

export interface TransferLegUpdates {
  fees: Map<string, number>;
  flagged: Map<TransferStage, string[]>;
  saved: Map<SavingCategory, string[]>;
}

type LegEvidence = PairEvidence | "refuted" | "unnamed";

interface StoredLeg extends TransferCandidate {
  counterpartyName?: string | null;
  creditorAccountIban: string | null;
  debtorAccountIban: string | null;
}

export const transferCandidateOf = (
  {
    counterpartyName,
    creditorAccountIban,
    debtorAccountIban,
    ...leg
  }: StoredLeg,
  accountIban: string | null | undefined
): TransferCandidate => ({
  ...leg,
  accountIban: ibanKeyOf(accountIban),
  counterpartyIban: ibanKeyOf(
    leg.amount < 0 ? creditorAccountIban : debtorAccountIban
  ),
  counterpartyNameKey: ownerNameKeyOf(counterpartyName),
});

const ibanEvidenceOf = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate
): LegEvidence => {
  const links = [
    { account: incoming.accountIban, named: outgoing.counterpartyIban },
    { account: outgoing.accountIban, named: incoming.counterpartyIban },
  ].filter(({ named }) => named);

  if (links.length === 0) {
    const areDistinctIbans =
      outgoing.accountIban &&
      incoming.accountIban &&
      outgoing.accountIban !== incoming.accountIban;

    return areDistinctIbans ? "unnamed" : "unknown";
  }

  const isConfirmed =
    links.some(({ account, named }) => account === named) &&
    links.every(({ account, named }) => !account || account === named);

  return isConfirmed ? "confirmed" : "refuted";
};

const nameEvidenceOf = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate
): LegEvidence => {
  const named = new Set(
    [outgoing.namesOwner, incoming.namesOwner].filter(
      (namesOwner) => namesOwner !== null && namesOwner !== undefined
    )
  );

  return named.has(true) && !named.has(false) ? "named" : "refuted";
};

const movesIntoHolderAccount = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate
): boolean =>
  incoming.fundedByHolder === true &&
  TRANSFER_CHANNELS.has(outgoing.channel ?? "unknown");

const evidenceOf = (
  outgoing: TransferCandidate,
  incoming: TransferCandidate
): LegEvidence => {
  const evidence = ibanEvidenceOf(outgoing, incoming);

  if (evidence !== "unnamed") {
    return evidence;
  }

  const byName = nameEvidenceOf(outgoing, incoming);

  return byName === "refuted" && movesIntoHolderAccount(outgoing, incoming)
    ? "destination"
    : byName;
};

const withinWindow = (
  a: TransferCandidate,
  b: TransferCandidate,
  evidence: PairEvidence
) =>
  Math.abs(a.date.getTime() - b.date.getTime()) <=
  (evidence === "unknown"
    ? PAIR_DATE_TOLERANCE_MS
    : CONFIRMED_PAIR_DATE_TOLERANCE_MS);

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
  evidence: PairEvidence,
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
        withinWindow(candidate, incoming, evidence) &&
        evidenceOf(candidate, incoming) === evidence;

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
        evidence,
        exchangeFeeMinor: exchangeFeeOf(best.leg, incoming, rates),
        incoming,
        outgoing: best.leg,
      });
    }
  }

  return pairs;
};

const sameCurrencyPairs = (
  candidates: readonly TransferCandidate[],
  paired: Set<string>,
  evidence: PairEvidence
): TransferPair[] => {
  const pairs: TransferPair[] = [];
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
      const isOppositeLeg =
        !paired.has(outgoing.id) &&
        outgoing.accountId !== incoming.accountId &&
        outgoing.currency === incoming.currency &&
        withinWindow(outgoing, incoming, evidence) &&
        evidenceOf(outgoing, incoming) === evidence;

      if (isOppositeLeg) {
        paired.add(incoming.id);
        paired.add(outgoing.id);
        pairs.push({ evidence, incoming, outgoing });

        break;
      }
    }
  }

  return pairs;
};

export const pairedLegs = (
  candidates: readonly TransferCandidate[],
  rates: RateBook | null = null
): TransferPair[] => {
  const paired = new Set<string>();
  const currencies = new Set(candidates.map((tx) => tx.currency));

  return (["confirmed", "named", "destination", "unknown"] as const).flatMap(
    (evidence) => [
      ...sameCurrencyPairs(candidates, paired, evidence),
      ...(rates && currencies.size > 1
        ? crossCurrencyPairs(candidates, paired, evidence, rates)
        : []),
    ]
  );
};

export type AccountsByIban = ReadonlyMap<string, readonly string[]>;

export const accountsByIbanOf = (
  accounts: readonly { iban: string | null; id: string }[]
): AccountsByIban => {
  const byIban = new Map<string, string[]>();

  for (const { iban, id } of accounts) {
    const key = ibanKeyOf(iban);

    if (key !== null) {
      const ids = byIban.get(key) ?? [];

      ids.push(id);
      byIban.set(key, ids);
    }
  }

  return byIban;
};

export const linkedAccountOf = (
  leg: TransferCandidate,
  accountsByIban: AccountsByIban
): string | null => {
  const named = leg.counterpartyIban ?? null;

  if (named === null) {
    return null;
  }

  return accountsByIban.get(named)?.find((id) => id !== leg.accountId) ?? null;
};

export const ownAccountLegs = (
  candidates: readonly TransferCandidate[],
  paired: ReadonlySet<string>,
  accountsByIban: AccountsByIban,
  own: OwnCounterparties
): OwnAccountLeg[] =>
  candidates.flatMap<OwnAccountLeg>((leg) => {
    if (paired.has(leg.id)) {
      return [];
    }

    const linked = linkedAccountOf(leg, accountsByIban);

    if (linked !== null) {
      return [{ leg, otherAccountId: linked }];
    }

    return isDeclaredOwn(leg, own) || leg.namesOwner === true
      ? [{ leg, otherAccountId: null }]
      : [];
  });

export const ownerNamesConfirmedBy = (
  candidates: readonly TransferCandidate[],
  pairs: readonly TransferPair[],
  accountsByIban: AccountsByIban
): Set<string> => {
  const confirmedLegs = [
    ...candidates.filter(
      (leg) => linkedAccountOf(leg, accountsByIban) !== null
    ),
    ...pairs.flatMap(({ evidence, incoming, outgoing }) =>
      evidence === "confirmed" ? [incoming, outgoing] : []
    ),
  ];

  return new Set(
    confirmedLegs.flatMap(({ counterpartyNameKey }) =>
      counterpartyNameKey && isOwnerNameKey(counterpartyNameKey)
        ? [counterpartyNameKey]
        : []
    )
  );
};

const savingCategoryOf = (
  fromAccountId: string,
  intoAccountId: string | null,
  accountTypeOf: ReadonlyMap<string, string>
): SavingCategory | null => {
  if (intoAccountId === null) {
    return null;
  }

  const from = accountTypeRule(accountTypeOf.get(fromAccountId) ?? "");
  const into = accountTypeRule(accountTypeOf.get(intoAccountId) ?? "");

  return from.countsInCashFlow ? into.savingCategory : null;
};

export const transferLegUpdates = (
  pairs: readonly TransferPair[],
  accountTypeOf: ReadonlyMap<string, string>,
  singles: readonly OwnAccountLeg[] = []
): TransferLegUpdates => {
  const flagged = new Map<TransferStage, string[]>();
  const saved = new Map<SavingCategory, string[]>();
  const fees = new Map<string, number>();

  const flag = (stage: TransferStage, ...ids: string[]) => {
    const stageIds = flagged.get(stage) ?? [];

    stageIds.push(...ids);
    flagged.set(stage, stageIds);
  };

  const save = (category: SavingCategory | null, id: string) => {
    if (category !== null) {
      const categoryIds = saved.get(category) ?? [];

      categoryIds.push(id);
      saved.set(category, categoryIds);
    }
  };

  for (const { exchangeFeeMinor, incoming, outgoing } of pairs) {
    flag("internal-transfer", incoming.id, outgoing.id);

    if (exchangeFeeMinor) {
      fees.set(outgoing.id, exchangeFeeMinor);
    }

    save(
      savingCategoryOf(outgoing.accountId, incoming.accountId, accountTypeOf),
      outgoing.id
    );
  }

  for (const { leg, otherAccountId } of singles) {
    flag(
      otherAccountId === null ? OWN_COUNTERPARTY_STAGE : "internal-transfer",
      leg.id
    );

    if (leg.amount < 0) {
      save(
        savingCategoryOf(leg.accountId, otherAccountId, accountTypeOf),
        leg.id
      );
    }
  }

  return { fees, flagged, saved };
};

export const transferCandidatesWhere = (
  accountIds: string[],
  bookedSince: Date | null
): Prisma.TransactionWhereInput => ({
  OR: [
    { isInternalTransfer: false },
    { isInternalTransfer: true, resolutionStage: OWN_COUNTERPARTY_STAGE },
  ],
  accountId: { in: accountIds },
  categoryOverride: false,
  date:
    bookedSince === null
      ? undefined
      : {
          gte: new Date(
            bookedSince.getTime() - CONFIRMED_PAIR_DATE_TOLERANCE_MS
          ),
        },
});

const HOLDER_FUNDED_SAVINGS = new Set<SavingCategory | null>([
  "savings",
  "securities",
]);

export const isFundedByHolder = (accountType: string): boolean =>
  HOLDER_FUNDED_SAVINGS.has(accountTypeRule(accountType).savingCategory);

export const withOwnerSignal = (
  candidates: readonly TransferCandidate[],
  own: OwnCounterparties
): TransferCandidate[] =>
  candidates.map((leg) => ({ ...leg, namesOwner: namesOwnerOf(leg, own) }));

const withLearnedNames = (
  own: OwnCounterparties,
  names: ReadonlySet<string>
): OwnCounterparties => ({
  ...own,
  ownerNames: new Set([...own.ownerNames, ...names]),
});

const FLAGGED_LEG = {
  category: null,
  isInternalTransfer: true,
  resolutionConfidence: 1,
} as const satisfies Prisma.TransactionUpdateManyMutationInput;

interface StoredLegState {
  category: string | null;
  isInternalTransfer: boolean;
  resolutionConfidence: number | null;
  resolutionStage: string | null;
  resolvedCategory: string | null;
}

const transferUpdates = (
  { fees, flagged, saved }: TransferLegUpdates,
  stateOf: ReadonlyMap<string, StoredLegState>
) => {
  const savedIds = new Set([...saved.values()].flat());

  const needsUpdate =
    (resolutionStage: TransferStage, resolvedCategory: string) =>
    (id: string) => {
      const state = stateOf.get(id);

      return !(
        state &&
        state.category === FLAGGED_LEG.category &&
        state.isInternalTransfer === FLAGGED_LEG.isInternalTransfer &&
        state.resolutionConfidence === FLAGGED_LEG.resolutionConfidence &&
        state.resolutionStage === resolutionStage &&
        state.resolvedCategory === resolvedCategory
      );
    };

  const flagUpdates = [...flagged].map(([stage, ids]) => ({
    flaggedLeg: {
      ...FLAGGED_LEG,
      resolutionStage: stage,
      resolvedCategory: INTERNAL_TRANSFER_CATEGORY,
    },
    ids: ids
      .filter((id) => !savedIds.has(id))
      .filter(needsUpdate(stage, INTERNAL_TRANSFER_CATEGORY)),
  }));

  const saveUpdates = [...saved].map(([category, ids]) => ({
    flaggedLeg: {
      ...FLAGGED_LEG,
      resolutionStage: "internal-transfer" satisfies TransferStage,
      resolvedCategory: category,
    },
    ids: ids.filter(needsUpdate("internal-transfer", category)),
  }));

  return [
    ...[...flagUpdates, ...saveUpdates].flatMap(({ flaggedLeg, ids }) =>
      ids.length === 0
        ? []
        : [
            prisma.transaction.updateMany({
              data: flaggedLeg,
              where: { id: { in: ids } },
            }),
          ]
    ),
    ...[...fees].map(([id, exchangeFeeMinor]) =>
      prisma.transaction.update({
        data: { exchangeFeeMinor },
        where: { id },
      })
    ),
  ];
};

const matchInternal = async (
  userId: string,
  bookedSince: Date | null
): Promise<number> => {
  const accounts = await prisma.bankAccount.findMany({
    select: { iban: true, id: true, type: true },
    where: {
      connection: { userId },
      type: { in: INTERNAL_TRANSFER_ACCOUNT_TYPES },
    },
  });

  if (accounts.length === 0) {
    return 0;
  }

  const ibanOf = new Map(accounts.map(({ iban, id }) => [id, iban]));
  const fundedByHolder = new Set(
    accounts.flatMap(({ id, type }) => (isFundedByHolder(type) ? [id] : []))
  );

  const accountsByIban = accountsByIbanOf(accounts);

  const [legs, stored] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { date: "asc" },
      select: {
        accountId: true,
        amount: true,
        category: true,
        channel: true,
        counterpartyName: true,
        creditorAccountIban: true,
        currency: true,
        date: true,
        debtorAccountIban: true,
        id: true,
        isInternalTransfer: true,
        merchantKey: true,
        originalAmount: true,
        originalCurrency: true,
        resolutionConfidence: true,
        resolutionStage: true,
        resolvedCategory: true,
      },
      where: transferCandidatesWhere([...ibanOf.keys()], bookedSince),
    }),
    loadOwnCounterparties(userId),
  ]);

  const unsigned = legs.map((leg) => ({
    ...transferCandidateOf(leg, ibanOf.get(leg.accountId)),
    fundedByHolder: fundedByHolder.has(leg.accountId),
  }));

  const [first] = unsigned;
  const last = unsigned.at(-1);

  if (!(first && last)) {
    return 0;
  }

  const linkedOwnerNames = ownerNamesConfirmedBy(unsigned, [], accountsByIban);
  const own = withLearnedNames(stored, linkedOwnerNames);

  const candidates = withOwnerSignal(unsigned, own);

  const rates = await loadRateBook(
    [...new Set(candidates.map((tx) => tx.currency))],
    first.date,
    last.date
  );

  const pairs = pairedLegs(candidates, rates);
  const paired = new Set(
    pairs.flatMap(({ incoming, outgoing }) => [incoming.id, outgoing.id])
  );

  const singles = ownAccountLegs(candidates, paired, accountsByIban, own);

  const updates = transferLegUpdates(
    pairs,
    new Map(accounts.map((account) => [account.id, account.type])),
    singles
  );

  if (updates.flagged.size > 0) {
    await prisma.$transaction(
      transferUpdates(updates, new Map(legs.map((leg) => [leg.id, leg])))
    );
  }

  await rememberOwnerNames(
    userId,
    [...linkedOwnerNames, ...ownerNamesConfirmedBy([], pairs, accountsByIban)],
    "pairing"
  );

  return [...updates.flagged.values()].flat().length;
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
