import { beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";

import { matchAccounts, reopenConnection } from "./reopen-connection";
import type { KnownAccount } from "./reopen-connection";

const known = (
  id: string,
  overrides: Partial<KnownAccount> = {}
): KnownAccount => ({
  iban: null,
  id,
  identificationHash: null,
  name: null,
  providerAccountId: `uid-${id}`,
  ...overrides,
});

const knownIdsOf = (...args: Parameters<typeof matchAccounts>) =>
  matchAccounts(...args).map(({ knownId }) => knownId);

describe("matchAccounts", () => {
  it("keeps the accounts a provider returns under the same id", () => {
    expect(
      knownIdsOf(
        [known("checking"), known("savings")],
        [
          { providerAccountId: "uid-savings" },
          { providerAccountId: "uid-checking" },
        ]
      )
    ).toEqual(["savings", "checking"]);
  });

  it("links a new session's accounts by their hash", () => {
    expect(
      knownIdsOf(
        [
          known("checking", { identificationHash: "hash-checking" }),
          known("savings", { identificationHash: "hash-savings" }),
        ],
        [
          { identificationHash: "hash-savings", providerAccountId: "new-1" },
          { identificationHash: "hash-checking", providerAccountId: "new-2" },
        ]
      )
    ).toEqual(["savings", "checking"]);
  });

  it("tells accounts that share a hash apart by name", () => {
    expect(
      knownIdsOf(
        [
          known("eur", { identificationHash: "hash", name: "EUR" }),
          known("usd", { identificationHash: "hash", name: "USD" }),
        ],
        [
          { identificationHash: "hash", name: "USD", providerAccountId: "a" },
          { identificationHash: "hash", name: "EUR", providerAccountId: "b" },
        ]
      )
    ).toEqual(["usd", "eur"]);
  });

  it("falls back to the IBAN only where a hash is missing", () => {
    const iban = "FR7630001007941234567890185";

    expect(
      knownIdsOf(
        [known("legacy", { iban })],
        [{ iban, identificationHash: "hash", providerAccountId: "new" }]
      )
    ).toEqual(["legacy"]);

    expect(
      knownIdsOf(
        [known("other", { iban, identificationHash: "other" })],
        [{ iban, identificationHash: "hash", providerAccountId: "new" }]
      )
    ).toEqual([null]);
  });

  it("leaves an account it never saw unmatched, and claims a row once", () => {
    expect(
      knownIdsOf(
        [known("checking", { identificationHash: "hash" })],
        [
          { identificationHash: "hash", providerAccountId: "a" },
          { identificationHash: "hash", providerAccountId: "b" },
          { providerAccountId: "c" },
        ]
      )
    ).toEqual(["checking", null, null]);
  });
});

describe("reopenConnection", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  it("reports the accounts this consent left out, not the ones an earlier consent did", async () => {
    const userId = `owner-${randomUUID()}`;

    await prisma.user.create({
      data: { email: `${userId}@example.test`, firstName: "Owner", id: userId },
    });

    const connection = await prisma.bankConnection.create({
      data: {
        accounts: {
          create: [
            { name: "Checking", providerAccountId: "checking" },
            { name: "Savings", providerAccountId: "savings" },
            { inConsent: false, name: "Joint", providerAccountId: "joint" },
          ],
        },
        institutionName: "Mock Bank",
        provider: "mock",
        providerSessionId: randomUUID(),
        userId,
      },
      select: {
        accounts: { select: { id: true, providerAccountId: true } },
        id: true,
      },
    });

    const savings = connection.accounts.find(
      (account) => account.providerAccountId === "savings"
    );

    expect(
      await reopenConnection(
        connection.id,
        {
          accounts: [{ providerAccountId: "checking" }],
          institutionName: "Mock Bank",
          providerSessionId: randomUUID(),
        },
        randomUUID()
      )
    ).toEqual({ leftOutAccountIds: [savings?.id ?? ""] });
  });
});
