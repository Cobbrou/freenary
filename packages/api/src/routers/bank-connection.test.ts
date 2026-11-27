import { beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { Effect, Schedule } from "effect";

import {
  releasePairedTransfers,
  rematchReleasedTransfersWith,
} from "../lib/remove-bank-accounts";
import { NOTIFICATION_TYPES } from "../notifications/types";
import { mockSessionCode } from "../providers/mock/session";
import { codeOf, contextOf } from "../testing";
import { appRouter } from "./index";

type Client = RouterClient<typeof appRouter>;

const BOOKED_ON = new Date("2026-10-01T00:00:00.000Z");
const LATER_ON = new Date("2026-10-15T00:00:00.000Z");
const RELEASED_SINCE = new Date("2026-09-27T00:00:00.000Z");
const SYNC_POLL_INTERVAL = "20 millis";

const clientOf = (userId: string): Client =>
  createRouterClient(appRouter, { context: contextOf(userId) });

const createUser = async (name: string): Promise<string> => {
  const id = `${name}-${randomUUID()}`;

  await prisma.user.create({
    data: { email: `${id}@example.test`, firstName: name, id },
  });

  return id;
};

const createConnection = (userId: string) =>
  prisma.bankConnection.create({
    data: {
      institutionCountry: "FR",
      institutionId: "mock-bank",
      institutionName: "Mock Bank",
      provider: "mock",
      providerSessionId: mockSessionCode(BOOKED_ON),
      userId,
    },
    select: { id: true },
  });

const createAccount = async (
  connectionId: string,
  name: string,
  type: Prisma.BankAccountCreateInput["type"],
  inConsent: boolean
): Promise<string> => {
  const { id } = await prisma.bankAccount.create({
    data: {
      balances: { create: { balanceMinor: 10_000, currency: "EUR" } },
      connectionId,
      currency: "EUR",
      holdings: {
        create: {
          currency: "EUR",
          label: "World ETF",
          providerHoldingId: `${name}-etf`,
          quantity: 1,
          valuationMinor: 10_000,
        },
      },
      inConsent,
      name,
      providerAccountId: name,
      type,
    },
    select: { id: true },
  });

  return id;
};

const createLeg = async (
  accountId: string,
  amount: number,
  date: Date,
  isInternalTransfer: boolean
): Promise<string> => {
  const { id } = await prisma.transaction.create({
    data: {
      accountId,
      amount,
      currency: "EUR",
      date,
      description: "VIREMENT",
      isInternalTransfer,
      resolutionConfidence: isInternalTransfer ? 1 : null,
      resolutionStage: isInternalTransfer ? "internal-transfer" : null,
      resolvedCategory: isInternalTransfer ? "internal-transfer" : null,
    },
    select: { id: true },
  });

  return id;
};

const createHousehold = async () => {
  const [ownerId, intruderId] = await Promise.all([
    createUser("owner"),
    createUser("intruder"),
  ]);

  const kept = await createConnection(ownerId);
  const removed = await createConnection(ownerId);

  const checkingId = await createAccount(kept.id, "checking", "CHECKING", true);
  const savingsId = await createAccount(kept.id, "savings", "SAVINGS", true);
  const jointId = await createAccount(kept.id, "joint", "CHECKING", false);
  const otherBankId = await createAccount(
    removed.id,
    "other-bank",
    "CHECKING",
    true
  );

  const toJointLeg = await createLeg(checkingId, -10_000, BOOKED_ON, true);
  const jointLeg = await createLeg(jointId, 10_000, BOOKED_ON, true);
  const toSavingsLeg = await createLeg(checkingId, -50_000, LATER_ON, true);
  const savingsLeg = await createLeg(savingsId, 50_000, LATER_ON, true);
  const toOtherBankLeg = await createLeg(savingsId, -7000, BOOKED_ON, true);
  const otherBankLeg = await createLeg(otherBankId, 7000, BOOKED_ON, true);

  await prisma.notification.create({
    data: {
      transactions: { create: [{ transactionId: jointLeg }] },
      type: NOTIFICATION_TYPES.transactionsToCheck,
      userId: ownerId,
    },
  });

  return {
    checkingId,
    intruderId,
    jointId,
    jointLeg,
    keptConnectionId: kept.id,
    otherBankId,
    otherBankLeg,
    ownerId,
    removedConnectionId: removed.id,
    savingsId,
    savingsLeg,
    toJointLeg,
    toOtherBankLeg,
    toSavingsLeg,
  };
};

type Household = Awaited<ReturnType<typeof createHousehold>>;

const ID = { select: { id: true } } as const;

const rowsOf = (ownerId: string) =>
  prisma.bankConnection.findMany({
    orderBy: { id: "asc" },
    select: {
      accounts: {
        orderBy: { id: "asc" },
        select: {
          balances: ID,
          holdings: ID,
          id: true,
          inConsent: true,
          transactions: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              isInternalTransfer: true,
              notifications: { select: { notificationId: true } },
              resolutionStage: true,
            },
          },
        },
      },
      id: true,
    },
    where: { userId: ownerId },
  });

const leftOf = async (accountIds: string[]) => ({
  accounts: await prisma.bankAccount.count({
    where: { id: { in: accountIds } },
  }),
  balances: await prisma.accountBalance.count({
    where: { accountId: { in: accountIds } },
  }),
  holdings: await prisma.holding.count({
    where: { accountId: { in: accountIds } },
  }),
  transactions: await prisma.transaction.count({
    where: { accountId: { in: accountIds } },
  }),
});

const NOTHING_LEFT = { accounts: 0, balances: 0, holdings: 0, transactions: 0 };

const transferStatesOf = async (transactionIds: string[]) => {
  const rows = await prisma.transaction.findMany({
    orderBy: { id: "asc" },
    select: {
      category: true,
      exchangeFeeMinor: true,
      id: true,
      isInternalTransfer: true,
      resolutionConfidence: true,
      resolutionStage: true,
      resolvedCategory: true,
    },
    where: { id: { in: transactionIds } },
  });

  return rows.map((row) => ({
    category: row.category,
    exchangeFeeMinor: row.exchangeFeeMinor,
    id: row.id,
    isInternalTransfer: row.isInternalTransfer,
    resolutionConfidence: row.resolutionConfidence,
    resolutionStage: row.resolutionStage,
    resolvedCategory: row.resolvedCategory,
  }));
};

const isTransfer = async (transactionId: string): Promise<boolean> => {
  const { isInternalTransfer } = await prisma.transaction.findUniqueOrThrow({
    select: { isInternalTransfer: true },
    where: { id: transactionId },
  });

  return isInternalTransfer;
};

const categorisationFinished = (userId: string) =>
  Effect.runPromise(
    Effect.promise(() =>
      prisma.syncRun.findUnique({
        select: { finishedAt: true },
        where: { userId },
      })
    ).pipe(
      Effect.repeat({
        schedule: Schedule.spaced(SYNC_POLL_INTERVAL),
        until: (run) => run === null || run.finishedAt !== null,
      })
    )
  );

beforeAll(async () => {
  await startTestDatabase();
});

describe("bankConnection.deleteAccounts", () => {
  it("deletes a not shared account with its transactions, holdings and balances", async () => {
    const household = await createHousehold();

    expect(
      await clientOf(household.ownerId).bankConnection.deleteAccounts({
        accountIds: [household.jointId],
      })
    ).toEqual({ accountsRemoved: 1 });

    expect(await leftOf([household.jointId])).toEqual(NOTHING_LEFT);
    expect(
      await prisma.notificationTransaction.count({
        where: { transactionId: household.jointLeg },
      })
    ).toBe(0);

    await categorisationFinished(household.ownerId);
  });

  it("leaves the other accounts of the connection untouched", async () => {
    const household = await createHousehold();
    const others = [
      household.checkingId,
      household.savingsId,
      household.otherBankId,
    ];

    const before = await leftOf(others);

    await clientOf(household.ownerId).bankConnection.deleteAccounts({
      accountIds: [household.jointId],
    });

    expect(await leftOf(others)).toEqual(before);
    expect(
      await prisma.bankConnection.count({
        where: { id: household.keptConnectionId },
      })
    ).toBe(1);

    await categorisationFinished(household.ownerId);
  });

  it("releases the leg that was paired with a deleted transaction, and keeps the other pairs", async () => {
    const household = await createHousehold();

    await clientOf(household.ownerId).bankConnection.deleteAccounts({
      accountIds: [household.jointId],
    });

    await categorisationFinished(household.ownerId);

    expect(await isTransfer(household.toJointLeg)).toBe(false);
    expect(await isTransfer(household.toSavingsLeg)).toBe(true);
    expect(await isTransfer(household.savingsLeg)).toBe(true);
  });

  it("leaves the pairs no deleted transaction belonged to exactly as they were", async () => {
    const household = await createHousehold();
    const unrelated = [
      household.toSavingsLeg,
      household.savingsLeg,
      household.toOtherBankLeg,
      household.otherBankLeg,
    ];

    const before = await transferStatesOf(unrelated);

    await clientOf(household.ownerId).bankConnection.deleteAccounts({
      accountIds: [household.jointId],
    });

    await categorisationFinished(household.ownerId);

    expect(await transferStatesOf(unrelated)).toEqual(before);
  });

  it("keeps a pair between kept accounts that matches a deleted leg as well", async () => {
    const household = await createHousehold();
    const toSavings = await createLeg(
      household.checkingId,
      -50_000,
      BOOKED_ON,
      true
    );

    const fromChecking = await createLeg(
      household.savingsId,
      50_000,
      BOOKED_ON,
      true
    );

    await createLeg(household.jointId, -50_000, BOOKED_ON, true);

    await clientOf(household.ownerId).bankConnection.deleteAccounts({
      accountIds: [household.jointId],
    });

    await categorisationFinished(household.ownerId);

    expect(await isTransfer(toSavings)).toBe(true);
    expect(await isTransfer(fromChecking)).toBe(true);
  });

  it("refuses another user's account, and deletes nothing", async () => {
    const household: Household = await createHousehold();
    const before = await rowsOf(household.ownerId);

    expect(
      await codeOf(
        clientOf(household.intruderId).bankConnection.deleteAccounts({
          accountIds: [household.jointId],
        })
      )
    ).toBe("NOT_FOUND");

    expect(await rowsOf(household.ownerId)).toEqual(before);
  });

  it("refuses a batch that holds one account of another user, and deletes nothing", async () => {
    const household = await createHousehold();
    const intruderConnection = await createConnection(household.intruderId);
    const intruderAccountId = await createAccount(
      intruderConnection.id,
      "intruder",
      "CHECKING",
      false
    );

    const before = await rowsOf(household.ownerId);

    expect(
      await codeOf(
        clientOf(household.intruderId).bankConnection.deleteAccounts({
          accountIds: [intruderAccountId, household.jointId],
        })
      )
    ).toBe("NOT_FOUND");

    expect(await rowsOf(household.ownerId)).toEqual(before);
    expect(await leftOf([intruderAccountId])).toMatchObject({ accounts: 1 });
  });

  it("refuses an account its bank still shares", async () => {
    const household = await createHousehold();
    const before = await rowsOf(household.ownerId);

    expect(
      await codeOf(
        clientOf(household.ownerId).bankConnection.deleteAccounts({
          accountIds: [household.jointId, household.checkingId],
        })
      )
    ).toBe("PRECONDITION_FAILED");

    expect(await rowsOf(household.ownerId)).toEqual(before);
  });
});

describe("bankConnection.disconnect", () => {
  it("deletes the accounts of the connection with their transactions, holdings and balances", async () => {
    const household = await createHousehold();

    await clientOf(household.ownerId).bankConnection.disconnect({
      connectionId: household.removedConnectionId,
    });

    expect(await leftOf([household.otherBankId])).toEqual(NOTHING_LEFT);

    await categorisationFinished(household.ownerId);
  });

  it("releases the leg in another connection that was paired with a deleted transaction", async () => {
    const household = await createHousehold();

    await clientOf(household.ownerId).bankConnection.disconnect({
      connectionId: household.removedConnectionId,
    });

    await categorisationFinished(household.ownerId);

    expect(await isTransfer(household.toOtherBankLeg)).toBe(false);
    expect(await isTransfer(household.toJointLeg)).toBe(true);
    expect(await isTransfer(household.toSavingsLeg)).toBe(true);
  });
});

const deleteJointAccount = (household: Household) =>
  prisma.$transaction(async (db) => {
    const removed = { id: household.jointId };
    const released = await releasePairedTransfers(
      db,
      household.ownerId,
      removed
    );

    await db.bankAccount.deleteMany({ where: removed });

    return released;
  });

describe("rematchReleasedTransfersWith", () => {
  it("releases every kept pair around a deleted leg, from the tolerance before it", async () => {
    const household = await createHousehold();

    const released = await deleteJointAccount(household);

    expect(released.legs.map(({ id }) => id).toSorted()).toEqual(
      [
        household.toJointLeg,
        household.toOtherBankLeg,
        household.otherBankLeg,
      ].toSorted()
    );

    expect(released.since).toEqual(RELEASED_SINCE);
  });

  it("matches from the tolerance before the earliest deleted leg, then categorises", async () => {
    const household = await createHousehold();
    const calls: string[] = [];
    const released = await deleteJointAccount(household);

    await rematchReleasedTransfersWith({
      categorise: (userId) => {
        calls.push(`categorise:${userId}`);

        return Promise.resolve(null);
      },
      match: (userId, since) => {
        calls.push(`match:${userId}:${since?.toISOString()}`);

        return Promise.resolve(0);
      },
    })(household.ownerId, released);

    expect(calls).toEqual([
      `match:${household.ownerId}:${RELEASED_SINCE.toISOString()}`,
      `categorise:${household.ownerId}`,
    ]);
  });

  it("keeps the released legs as transfers and categorises nothing when matching fails", async () => {
    const household = await createHousehold();
    const before = await transferStatesOf([household.toJointLeg]);
    const categorised: string[] = [];
    const released = await deleteJointAccount(household);

    expect(await isTransfer(household.toJointLeg)).toBe(false);

    await rematchReleasedTransfersWith({
      categorise: (userId) => {
        categorised.push(userId);

        return Promise.resolve(null);
      },
      match: () => Promise.reject(new Error("rate book unavailable")),
    })(household.ownerId, released);

    expect(categorised).toEqual([]);
    expect(await transferStatesOf([household.toJointLeg])).toEqual(before);
  });

  it("does nothing when no leg was released", async () => {
    const calls: string[] = [];

    await rematchReleasedTransfersWith({
      categorise: () => {
        calls.push("categorise");

        return Promise.resolve(null);
      },
      match: () => {
        calls.push("match");

        return Promise.resolve(0);
      },
    })("nobody", { legs: [], since: null });

    expect(calls).toEqual([]);
  });
});

describe("bankConnection.exchangeCode", () => {
  it("returns the accounts a reconnection left out, and none when the callback is replayed", async () => {
    const household = await createHousehold();
    const client = clientOf(household.ownerId);
    const { providerSessionId } = await prisma.bankConnection.findUniqueOrThrow(
      {
        select: { providerSessionId: true },
        where: { id: household.keptConnectionId },
      }
    );

    const { url } = await client.bankConnection.reconnect({
      connectionId: household.keptConnectionId,
      returnTo: "settings",
    });

    const state = new URL(url).searchParams.get("state") ?? "";
    const callback = {
      params: { code: providerSessionId, state },
      providerId: "mock",
    };

    const first = await client.bankConnection.exchangeCode(callback);

    expect(first.leftOutAccountIds.toSorted()).toEqual(
      [household.checkingId, household.savingsId].toSorted()
    );

    const replayed = await client.bankConnection.exchangeCode(callback);

    expect(replayed.connectionId).toBe(household.keptConnectionId);
    expect(replayed.leftOutAccountIds).toEqual([]);

    await categorisationFinished(household.ownerId);
  });
});

describe("bankConnection.listConnections", () => {
  it("lists the not shared accounts after the shared ones, with their transaction counts", async () => {
    const household = await createHousehold();

    const { connections } = await clientOf(
      household.ownerId
    ).bankConnection.listConnections();

    const kept = connections.find(
      (connection) => connection.id === household.keptConnectionId
    );

    expect(
      kept?.accounts.map(({ id, inConsent, transactionCount }) => ({
        id,
        inConsent,
        transactionCount,
      }))
    ).toEqual([
      { id: household.checkingId, inConsent: true, transactionCount: 2 },
      { id: household.savingsId, inConsent: true, transactionCount: 2 },
      { id: household.jointId, inConsent: false, transactionCount: 1 },
    ]);
  });
});
