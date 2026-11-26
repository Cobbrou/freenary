import type { Prisma, TransactionClient } from "@freenary/db";

import { CATEGORY_GROUP_OF, INTERNAL_TRANSFER_CATEGORY } from "../lib/taxonomy";
import type { SpendingCategory } from "../lib/taxonomy";
import { effectiveCategory } from "../lib/transaction-category";
import {
  counterpartyKeysOf,
  forgetDeclaredCounterparties,
  OWN_COUNTERPARTY_STAGE,
  recordCounterpartyDecision,
} from "./own-counterparty";
import type { CounterpartyKey } from "./own-counterparty";

interface StoredCounterparty {
  amount: number;
  counterpartyName: string | null;
  creditorAccountIban: string | null;
  debtorAccountIban: string | null;
  merchantKey: string | null;
}

interface StoredTransfer extends StoredCounterparty {
  category: string | null;
  isInternalTransfer: boolean;
  resolvedCategory: string | null;
}

export const COUNTERPARTY_SELECT = {
  amount: true,
  counterpartyName: true,
  creditorAccountIban: true,
  debtorAccountIban: true,
  merchantKey: true,
} as const satisfies Prisma.TransactionSelect;

export const storedCounterpartyKeysOf = (
  tx: StoredCounterparty
): CounterpartyKey[] =>
  counterpartyKeysOf({
    counterpartyIban:
      tx.amount < 0 ? tx.creditorAccountIban : tx.debtorAccountIban,
    counterpartyName: tx.counterpartyName,
    merchantKey: tx.merchantKey,
  });

export const sharesCounterpartyKey = (
  keys: readonly CounterpartyKey[],
  others: readonly CounterpartyKey[]
): boolean =>
  keys.some(({ key, kind }) =>
    others.some((other) => other.kind === kind && other.key === key)
  );

const RELEASED_LEG = {
  category: null,
  isInternalTransfer: false,
  resolutionConfidence: null,
  resolutionStage: null,
  resolvedCategory: null,
} as const satisfies Prisma.TransactionUpdateManyMutationInput;

const inferredLegsOf = (userId: string) =>
  ({
    account: { connection: { userId } },
    categoryOverride: false,
    isInternalTransfer: true,
    resolutionStage: OWN_COUNTERPARTY_STAGE,
  }) satisfies Prisma.TransactionWhereInput;

const releaseCounterpartyLegs = async (
  db: TransactionClient,
  userId: string,
  keys: readonly CounterpartyKey[]
): Promise<number> => {
  if (keys.length === 0) {
    return 0;
  }

  const flagged = await db.transaction.findMany({
    select: { ...COUNTERPARTY_SELECT, id: true },
    where: inferredLegsOf(userId),
  });

  const released = flagged.flatMap((tx) =>
    sharesCounterpartyKey(storedCounterpartyKeysOf(tx), keys) ? [tx.id] : []
  );

  if (released.length === 0) {
    return 0;
  }

  const { count } = await db.transaction.updateMany({
    data: RELEASED_LEG,
    where: { id: { in: released } },
  });

  return count;
};

export const releaseInferredSiblings = (
  db: TransactionClient,
  userId: string,
  merchantKey: string,
  transactionId: string
) =>
  db.transaction.updateMany({
    data: RELEASED_LEG,
    where: {
      ...inferredLegsOf(userId),
      id: { not: transactionId },
      merchantKey,
    },
  });

export type CounterpartyMemory = "forget" | "mine" | "none" | "not-mine";

export const counterpartyMemoryOf = (
  tx: StoredTransfer,
  category: SpendingCategory | null
): CounterpartyMemory => {
  if (category === null) {
    return "none";
  }

  if (category === INTERNAL_TRANSFER_CATEGORY) {
    return "mine";
  }

  const wasTransfer =
    tx.isInternalTransfer ||
    effectiveCategory(tx) === INTERNAL_TRANSFER_CATEGORY;

  return wasTransfer && CATEGORY_GROUP_OF[category] !== "investments"
    ? "not-mine"
    : "forget";
};

export const rememberCounterpartyFor = async (
  db: TransactionClient,
  userId: string,
  tx: StoredTransfer,
  category: SpendingCategory | null
): Promise<number> => {
  const keys = storedCounterpartyKeysOf(tx);

  if (keys.length === 0) {
    return 0;
  }

  const memory = counterpartyMemoryOf(tx, category);

  if (memory === "mine") {
    await recordCounterpartyDecision(db, userId, keys, true);

    return 0;
  }

  if (memory === "not-mine") {
    await recordCounterpartyDecision(db, userId, keys, false);

    return releaseCounterpartyLegs(db, userId, keys);
  }

  if (memory === "forget") {
    await forgetDeclaredCounterparties(db, userId, keys);
  }

  return 0;
};
