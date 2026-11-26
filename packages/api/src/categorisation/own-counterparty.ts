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

const DESCRIPTOR_LINK_WORDS = new Set(["A", "DE", "DU", "FROM", "TO", "VERS"]);

export const descriptorNameKeyOf = (
  merchantKey: string | null | undefined
): string | null => {
  const key = ownerNameKeyOf(merchantKey);

  if (key === null) {
    return null;
  }

  const words = new Set(
    key.split(" ").filter((word) => !DESCRIPTOR_LINK_WORDS.has(word))
  );

  return words.size === 0 ? null : [...words].toSorted().join(" ");
};

const describesOwner = (
  facts: CounterpartyFacts,
  own: OwnCounterparties
): boolean => {
  const merchantKey = facts.merchantKey ?? null;
  const name = descriptorNameKeyOf(merchantKey);

  return (
    name !== null &&
    merchantKey !== null &&
    !own.overriddenMerchantKeys.has(merchantKey) &&
    !own.refusedNames.has(name) &&
    own.ownerNames.has(name)
  );
};

export const namesOwnerOf = (
  facts: CounterpartyFacts,
  own: OwnCounterparties
): boolean | null => {
  const name = facts.counterpartyNameKey ?? null;
  const channel = facts.channel ?? "unknown";

  if (!TRANSFER_CHANNELS.has(channel)) {
    return null;
  }

  if (name === null) {
    return describesOwner(facts, own) ? true : null;
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

export const memberNameOf = (
  member: { firstName: string; lastName: string | null } | null
): string | null =>
  member?.lastName ? `${member.firstName} ${member.lastName}` : null;

export const ownCounterpartiesOf = ({
  memberName = null,
  overriddenMerchantKeys,
  stored,
}: {
  memberName?: string | null;
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
    prisma.user.findUnique({
      select: { firstName: true, lastName: true },
      where: { id: userId },
    }),
    prisma.merchantOverride.findMany({
      select: { merchantKey: true },
      where: { category: { not: INTERNAL_TRANSFER_CATEGORY }, userId },
    }),
  ]);

  return ownCounterpartiesOf({
    memberName: memberNameOf(member),
    overriddenMerchantKeys: overrides.map(({ merchantKey }) => merchantKey),
    stored,
  });
};

export const rememberOwnerNames = async (
  userId: string,
  names: Iterable<string>,
  source: "holder" | "pairing"
): Promise<void> => {
  const keys = [
    ...new Set(
      [...names].flatMap((name) => {
        const key = ownerNameKeyOf(name);

        return key === null ? [] : [key];
      })
    ),
  ].filter(isOwnerNameKey);

  if (keys.length === 0) {
    return;
  }

  await prisma.ownCounterparty.createMany({
    data: keys.map((key) => ({
      isOwn: true,
      key,
      kind: "name",
      source,
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
