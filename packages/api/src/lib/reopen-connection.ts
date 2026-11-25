import prisma from "@freenary/db";

import type { CompletedConnection } from "../providers/types";

type CompletedAccount = CompletedConnection["accounts"][number];

export interface KnownAccount {
  readonly iban: string | null;
  readonly id: string;
  readonly identificationHash: string | null;
  readonly name: string | null;
  readonly providerAccountId: string;
}

type SameAccount = (known: KnownAccount, account: CompletedAccount) => boolean;

const hasSameHash: SameAccount = (known, account) =>
  known.identificationHash !== null &&
  known.identificationHash === account.identificationHash;

const SUREST_FIRST: readonly SameAccount[] = [
  (known, account) => known.providerAccountId === account.providerAccountId,
  (known, account) =>
    hasSameHash(known, account) && known.name === (account.name ?? null),
  hasSameHash,
  (known, account) =>
    !(known.identificationHash && account.identificationHash) &&
    known.iban !== null &&
    known.iban === account.iban,
];

export const matchAccounts = (
  known: readonly KnownAccount[],
  completed: readonly CompletedAccount[]
): { account: CompletedAccount; knownId: string | null }[] => {
  const knownIds = new Map<CompletedAccount, string>();
  const unclaimed = new Set(known);

  for (const isSame of SUREST_FIRST) {
    for (const account of completed) {
      const match = knownIds.has(account)
        ? undefined
        : [...unclaimed].find((candidate) => isSame(candidate, account));

      if (match) {
        knownIds.set(account, match.id);
        unclaimed.delete(match);
      }
    }
  }

  return completed.map((account) => ({
    account,
    knownId: knownIds.get(account) ?? null,
  }));
};

export const reopenConnection = (
  connectionId: string,
  completed: CompletedConnection,
  exchangeNonce: string
): Promise<{ id: string; institutionName: string }> =>
  prisma.$transaction(async (db) => {
    const known = await db.bankAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        iban: true,
        id: true,
        identificationHash: true,
        name: true,
        providerAccountId: true,
      },
      where: { connectionId },
    });

    await db.bankAccount.updateMany({
      data: { inConsent: false },
      where: { connectionId },
    });

    for (const { account, knownId } of matchAccounts(
      known,
      completed.accounts
    )) {
      const {
        currency,
        iban,
        identificationHash,
        name,
        providerAccountId,
        type,
      } = account;

      // eslint-disable-next-line no-await-in-loop -- sequential to avoid unique constraint races
      await (knownId === null
        ? db.bankAccount.create({
            data: {
              connectionId,
              currency: currency ?? null,
              iban,
              identificationHash,
              name,
              providerAccountId,
              type,
            },
          })
        : db.bankAccount.update({
            data: {
              currency: currency ?? null,
              iban,
              identificationHash,
              inConsent: true,
              providerAccountId,
            },
            where: { id: knownId },
          }));
    }

    return await db.bankConnection.update({
      data: {
        exchangeNonce,
        lastSyncedAt: null,
        providerSessionId: completed.providerSessionId,
        status: "ACTIVE",
      },
      select: { id: true, institutionName: true },
      where: { id: connectionId },
    });
  });
