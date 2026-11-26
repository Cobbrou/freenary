import prisma from "@freenary/db";
import type { TransactionClient } from "@freenary/db";

import { INTERNAL_TRANSFER_CATEGORY } from "../lib/taxonomy";
import type { ResolutionStage } from "./types";

export const OWN_COUNTERPARTY_STAGE =
  "own-counterparty" satisfies ResolutionStage;

export const OWN_COUNTERPARTY_KINDS = ["iban", "merchant", "name"] as const;

export type OwnCounterpartyKind = (typeof OWN_COUNTERPARTY_KINDS)[number];

export interface CounterpartyKey {
  key: string;
  kind: OwnCounterpartyKind;
}

export interface OwnCounterparties {
  declaredIbans: ReadonlySet<string>;
  declaredMerchantKeys: ReadonlySet<string>;
  overriddenMerchantKeys: ReadonlySet<string>;
  ownerNames: ReadonlySet<string>;
  refusedIbans: ReadonlySet<string>;
  refusedMerchantKeys: ReadonlySet<string>;
  refusedNames: ReadonlySet<string>;
}

export interface CounterpartyFacts {
  channel?: string | null;
  counterpartyIban?: string | null;
  counterpartyNameKey?: string | null;
  merchantKey?: string | null;
}

const TITLES = new Set([
  "DR",
  "FRAU",
  "HERR",
  "M",
  "MADAME",
  "MADEMOISELLE",
  "MISS",
  "MLLE",
  "MME",
  "MONSIEUR",
  "MR",
  "MRS",
  "MS",
  "SR",
  "SRA",
]);

export const TRANSFER_CHANNELS: ReadonlySet<string> = new Set([
  "transfer",
  "unknown",
]);

const MIN_OWNER_NAME_WORDS = 2;

export const ownerNameKeyOf = (
  name: string | null | undefined
): string | null => {
  const words = (name ?? "")
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !TITLES.has(word));

  return words.length === 0 ? null : words.toSorted().join(" ");
};

export const isOwnerNameKey = (key: string): boolean =>
  key.split(" ").length >= MIN_OWNER_NAME_WORDS;

export const ibanKeyOf = (iban: string | null | undefined): string | null =>
  iban?.replaceAll(/\s/gu, "").toUpperCase() || null;

export const namesOwnerOf = (
  facts: CounterpartyFacts,
  own: OwnCounterparties
): boolean | null => {
  const name = facts.counterpartyNameKey ?? null;
  const channel = facts.channel ?? "unknown";

  if (name === null || !TRANSFER_CHANNELS.has(channel)) {
    return null;
  }

  const isOverridden =
    facts.merchantKey !== null &&
    facts.merchantKey !== undefined &&
    own.overriddenMerchantKeys.has(facts.merchantKey);

  if (isOverridden || own.refusedNames.has(name)) {
    return false;
  }

  return own.ownerNames.has(name);
};

export const isDeclaredOwn = (
  facts: CounterpartyFacts,
  own: OwnCounterparties
): boolean => {
  const iban = facts.counterpartyIban ?? null;
  const merchantKey = facts.merchantKey ?? null;

  if (merchantKey !== null && own.overriddenMerchantKeys.has(merchantKey)) {
    return false;
  }

  if (iban !== null && own.refusedIbans.has(iban)) {
    return false;
  }

  if (iban !== null && own.declaredIbans.has(iban)) {
    return true;
  }

  return (
    merchantKey !== null &&
    !own.refusedMerchantKeys.has(merchantKey) &&
    own.declaredMerchantKeys.has(merchantKey)
  );
};

export const counterpartyKeysOf = ({
  counterpartyIban,
  counterpartyName,
  merchantKey,
}: {
  counterpartyIban: string | null;
  counterpartyName: string | null;
  merchantKey: string | null;
}): CounterpartyKey[] => {
  const iban = ibanKeyOf(counterpartyIban);
  const name = ownerNameKeyOf(counterpartyName);
  const keys: CounterpartyKey[] = [];

  if (iban !== null) {
    keys.push({ key: iban, kind: "iban" });
  }

  if (name !== null) {
    keys.push({ key: name, kind: "name" });
  }

  if (keys.length === 0 && merchantKey) {
    keys.push({ key: merchantKey, kind: "merchant" });
  }

  return keys;
};

interface StoredOwnCounterparty {
  isOwn: boolean;
  key: string;
  kind: string;
}

export const ownCounterpartiesOf = ({
  memberName,
  overriddenMerchantKeys,
  stored,
}: {
  memberName: string | null;
  overriddenMerchantKeys: readonly string[];
  stored: readonly StoredOwnCounterparty[];
}): OwnCounterparties => {
  const keysWhere = (kind: OwnCounterpartyKind, isOwn: boolean) =>
    new Set(
      stored.flatMap((row) =>
        row.kind === kind && row.isOwn === isOwn ? [row.key] : []
      )
    );

  const ownerNames = keysWhere("name", true);
  const memberNameKey = ownerNameKeyOf(memberName);

  if (memberNameKey !== null && isOwnerNameKey(memberNameKey)) {
    ownerNames.add(memberNameKey);
  }

  return {
    declaredIbans: keysWhere("iban", true),
    declaredMerchantKeys: keysWhere("merchant", true),
    overriddenMerchantKeys: new Set(overriddenMerchantKeys),
    ownerNames,
    refusedIbans: keysWhere("iban", false),
    refusedMerchantKeys: keysWhere("merchant", false),
    refusedNames: keysWhere("name", false),
  };
};

export const loadOwnCounterparties = async (
  userId: string
): Promise<OwnCounterparties> => {
  const [stored, member, overrides] = await Promise.all([
    prisma.ownCounterparty.findMany({
      select: { isOwn: true, key: true, kind: true },
      where: { userId },
    }),
    prisma.user.findUnique({ select: { name: true }, where: { id: userId } }),
    prisma.merchantOverride.findMany({
      select: { merchantKey: true },
      where: { category: { not: INTERNAL_TRANSFER_CATEGORY }, userId },
    }),
  ]);

  return ownCounterpartiesOf({
    memberName: member?.name ?? null,
    overriddenMerchantKeys: overrides.map(({ merchantKey }) => merchantKey),
    stored,
  });
};

export const rememberOwnerNames = async (
  userId: string,
  names: Iterable<string>
): Promise<void> => {
  const keys = [...new Set(names)].filter(isOwnerNameKey);

  if (keys.length === 0) {
    return;
  }

  await prisma.ownCounterparty.createMany({
    data: keys.map((key) => ({
      isOwn: true,
      key,
      kind: "name",
      source: "pairing",
      userId,
    })),
    skipDuplicates: true,
  });
};

export const recordCounterpartyDecision = async (
  db: TransactionClient,
  userId: string,
  keys: readonly CounterpartyKey[],
  isOwn: boolean
): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  await db.ownCounterparty.deleteMany({
    where: { OR: keys.map(({ key, kind }) => ({ key, kind })), userId },
  });

  await db.ownCounterparty.createMany({
    data: keys.map(({ key, kind }) => ({
      isOwn,
      key,
      kind,
      source: "member",
      userId,
    })),
  });
};

export const forgetDeclaredCounterparties = (
  db: TransactionClient,
  userId: string,
  keys: readonly CounterpartyKey[]
) =>
  db.ownCounterparty.deleteMany({
    where: {
      OR: keys.map(({ key, kind }) => ({ key, kind })),
      isOwn: true,
      source: "member",
      userId,
    },
  });
