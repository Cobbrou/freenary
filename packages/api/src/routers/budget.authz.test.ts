import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { Effect, Schedule } from "effect";

import { customCategoryKey } from "../lib/categories";
import { NOTIFICATION_TYPES } from "../notifications/types";
import { mockSessionCode } from "../providers/mock/session";
import { codeOf, contextOf } from "../testing";
import { appRouter } from "./index";

type Client = RouterClient<typeof appRouter>;

const FIRST_RATE_DAY = new Date("1999-01-04T00:00:00.000Z");
const BOOKED_ON = new Date("2026-10-01T00:00:00.000Z");
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

const createHousehold = async () => {
  const [ownerId, intruderId] = await Promise.all([
    createUser("owner"),
    createUser("intruder"),
  ]);

  const connection = await prisma.bankConnection.create({
    data: {
      accounts: {
        create: {
          currency: "EUR",
          name: "Checking",
          providerAccountId: "checking",
          transactions: {
            create: {
              amount: -1250,
              currency: "EUR",
              date: BOOKED_ON,
              description: "NETFLIX",
              merchantKey: "netflix",
            },
          },
        },
      },
      institutionCountry: "FR",
      institutionId: "mock-bank",
      institutionName: "Mock Bank",
      provider: "mock",
      providerSessionId: mockSessionCode(BOOKED_ON),
      userId: ownerId,
    },
    select: {
      accounts: {
        select: { id: true, transactions: { select: { id: true } } },
      },
      id: true,
    },
  });

  const category = await prisma.customCategory.create({
    data: {
      color: "blue",
      icon: "BankIcon",
      label: "Holidays",
      userId: ownerId,
    },
  });

  await prisma.budgetLine.create({
    data: { amount: 5000, categoryId: category.id, userId: ownerId },
  });

  const savedFilter = await prisma.savedFilter.create({
    data: { filters: [], name: "Streaming", search: "net", userId: ownerId },
  });

  const notification = await prisma.notification.create({
    data: { type: NOTIFICATION_TYPES.transactionsToCheck, userId: ownerId },
  });

  const conversation = await prisma.conversation.create({
    data: { title: "Streaming", userId: ownerId },
  });

  const dashboard = await prisma.dashboard.create({
    data: { title: "Overview", userId: ownerId, widgets: [] },
  });

  return {
    accountId: connection.accounts[0]?.id ?? "",
    categoryId: category.id,
    connectionId: connection.id,
    conversationId: conversation.id,
    dashboardId: dashboard.id,
    intruderId,
    notificationId: notification.id,
    ownerId,
    savedFilterId: savedFilter.id,
    transactionId: connection.accounts[0]?.transactions[0]?.id ?? "",
  };
};

type Household = Awaited<ReturnType<typeof createHousehold>>;

const storedRowsOf = async (userIds: string[]) => ({
  consents: await prisma.verification.findMany({
    where: { value: { in: userIds } },
  }),
  users: await prisma.user.findMany({
    include: {
      bankConnections: {
        include: { accounts: { include: { transactions: true } } },
      },
      budgetLines: true,
      conversations: { include: { messages: true } },
      customCategories: true,
      dashboards: true,
      merchantOverrides: true,
      notifications: true,
      savedFilters: true,
    },
    orderBy: { id: "asc" },
    where: { id: { in: userIds } },
  }),
});

const rowsOf = async ({ intruderId, ownerId }: Household): Promise<string> =>
  JSON.stringify(await storedRowsOf([intruderId, ownerId]), null, 2);

const syncToTheEnd = async (client: Client, connectionId: string) => {
  const { startedAt } = await client.budget.syncAccounts({
    connectionId,
    force: true,
  });

  if (startedAt === null) {
    throw new TypeError("The sync did not start");
  }

  return await Effect.runPromise(
    Effect.promise(() => client.budget.getSyncOutcome({ startedAt })).pipe(
      Effect.repeat({
        schedule: Schedule.spaced(SYNC_POLL_INTERVAL),
        until: (outcome) => outcome !== null,
      })
    )
  );
};

const runFinished = (userId: string) =>
  Effect.runPromise(
    Effect.promise(() => prisma.syncRun.findUnique({ where: { userId } })).pipe(
      Effect.repeat({
        schedule: Schedule.spaced(SYNC_POLL_INTERVAL),
        until: (run) => run === null || run.finishedAt !== null,
      })
    )
  );

type Attempt = (client: Client, household: Household) => Promise<object>;

const REFUSED: [string, Attempt][] = [
  [
    "budget.excludeAccount",
    async ({ budget }, { accountId, ownerId }) => {
      const outcome = await budget.excludeAccount({
        accountId,
        excluded: true,
        reason: "Joint",
      });

      await runFinished(ownerId);

      return outcome;
    },
  ],
  [
    "budget.excludeTransaction",
    ({ budget }, { transactionId }) =>
      budget.excludeTransaction({
        excluded: true,
        reason: "Taken over",
        transactionId,
      }),
  ],
  [
    "budget.updateTransactionCategory",
    ({ budget }, { transactionId }) =>
      budget.updateTransactionCategory({
        category: "groceries",
        transactionId,
      }),
  ],
  [
    "budget.updateTransactionCategory, to clear it",
    ({ budget }, { transactionId }) =>
      budget.updateTransactionCategory({ category: null, transactionId }),
  ],
  [
    "budget.deleteSavedFilter",
    ({ budget }, { savedFilterId }) =>
      budget.deleteSavedFilter({ id: savedFilterId }),
  ],
  [
    "bankConnection.disconnect",
    ({ bankConnection }, { connectionId }) =>
      bankConnection.disconnect({ connectionId }),
  ],
  [
    "bankConnection.reconnect",
    ({ bankConnection }, { connectionId }) =>
      bankConnection.reconnect({ connectionId, returnTo: "settings" }),
  ],
  [
    "settings.createCustomCategory, under the owner's category",
    ({ settings }, { categoryId }) =>
      settings.createCustomCategory({
        color: "green",
        icon: "CarIcon",
        label: "Road trips",
        parentKey: customCategoryKey(categoryId),
      }),
  ],
  [
    "settings.updateCustomCategory",
    ({ settings }, { categoryId }) =>
      settings.updateCustomCategory({
        color: "green",
        icon: "CarIcon",
        id: categoryId,
        label: "Taken over",
        parentKey: null,
      }),
  ],
  [
    "settings.moveCustomCategory",
    ({ settings }, { categoryId }) =>
      settings.moveCustomCategory({ direction: "up", id: categoryId }),
  ],
  [
    "settings.deleteCustomCategory",
    ({ settings }, { categoryId }) =>
      settings.deleteCustomCategory({ id: categoryId }),
  ],
  [
    "notifications.markRead",
    ({ notifications }, { notificationId }) =>
      notifications.markRead({ id: notificationId }),
  ],
  [
    "notifications.dismiss",
    ({ notifications }, { notificationId }) =>
      notifications.dismiss({ id: notificationId }),
  ],
  [
    "notifications.restore",
    ({ notifications }, { notificationId }) =>
      notifications.restore({ id: notificationId }),
  ],
  [
    "notifications.clearTransactionsToCheck",
    ({ notifications }, { notificationId }) =>
      notifications.clearTransactionsToCheck({ id: notificationId }),
  ],
  [
    "portfolio.renameAccount",
    ({ portfolio }, { accountId }) =>
      portfolio.renameAccount({ accountId, name: "Taken over" }),
  ],
  [
    "dashboards.update",
    ({ dashboards }, { dashboardId }) =>
      dashboards.update({ dashboardId, title: "Taken over" }),
  ],
  [
    "assistant.saveTurn",
    ({ assistant }, { conversationId }) =>
      assistant.saveTurn({
        answer: {
          id: randomUUID(),
          parts: [{ text: "An answer", type: "text" }],
        },
        conversationId,
        question: [{ text: "A question", type: "text" }],
      }),
  ],
];

const IGNORED: [string, Attempt][] = [
  [
    "dashboards.delete",
    ({ dashboards }, { dashboardId }) => dashboards.delete({ dashboardId }),
  ],
  [
    "assistant.deleteConversation",
    ({ assistant }, { conversationId }) =>
      assistant.deleteConversation({ conversationId }),
  ],
];

let household: Household;

beforeAll(async () => {
  await startTestDatabase();

  await prisma.exchangeRate.createMany({
    data: [FIRST_RATE_DAY, new Date()].map((date) => ({
      currency: "USD",
      date,
      ratePerEur: 1.1,
    })),
    skipDuplicates: true,
  });
});

beforeEach(async () => {
  household = await createHousehold();
});

describe("a resource of another user", () => {
  it.each(REFUSED)(
    "is not found by %s, and stays as it was",
    async (_name, attempt) => {
      const before = await rowsOf(household);

      expect(
        await codeOf(attempt(clientOf(household.intruderId), household))
      ).toBe("NOT_FOUND");

      expect(await rowsOf(household)).toEqual(before);
    }
  );

  it.each(IGNORED)("stays as it was after %s", async (_name, attempt) => {
    const before = await rowsOf(household);

    await attempt(clientOf(household.intruderId), household);

    expect(await rowsOf(household)).toEqual(before);
  });

  it.each([...REFUSED, ...IGNORED])(
    "answers its owner on %s",
    async (_name, attempt) => {
      expect(
        await codeOf(attempt(clientOf(household.ownerId), household))
      ).toBe("OK");
    }
  );

  it("is refused as the category of a budget line", async () => {
    const before = await rowsOf(household);

    expect(
      await codeOf(
        clientOf(household.intruderId).settings.saveBudgetProfile({
          lines: [
            {
              amount: 100,
              categoryKey: customCategoryKey(household.categoryId),
              label: "",
            },
          ],
        })
      )
    ).toBe("BAD_REQUEST");

    expect(await rowsOf(household)).toEqual(before);
  });
});

describe("budget.syncAccounts", () => {
  it("imports nothing into another user's connection", async () => {
    const before = await rowsOf(household);

    expect(
      await syncToTheEnd(clientOf(household.intruderId), household.connectionId)
    ).toEqual({ categorised: 0, failures: [], success: true });

    expect(await rowsOf(household)).toEqual(before);
  });

  it("keeps the name the owner gave an account", async () => {
    const owner = clientOf(household.ownerId);
    const accountsOf = async () => {
      const { accounts } = await owner.portfolio.getOverview();

      return accounts;
    };

    const accountOf = async (accountId: string) => {
      const accounts = await accountsOf();

      return accounts.find(({ id }) => id === accountId);
    };

    await syncToTheEnd(owner, household.connectionId);

    const imported = await accountsOf();
    const synced = imported.find(
      ({ bankName, id }) => bankName !== null && id !== household.accountId
    );

    if (!synced) {
      throw new TypeError("The sync imported no named account");
    }

    await prisma.bankAccount.update({
      data: { name: "Stale" },
      where: { id: synced.id },
    });

    await owner.portfolio.renameAccount({
      accountId: synced.id,
      name: "  Joint account  ",
    });

    await syncToTheEnd(owner, household.connectionId);

    expect(await accountOf(synced.id)).toMatchObject({
      bankName: synced.bankName,
      customName: "Joint account",
      name: "Joint account",
    });

    await owner.portfolio.renameAccount({ accountId: synced.id, name: "" });

    expect(await accountOf(synced.id)).toMatchObject({
      customName: null,
      name: synced.bankName,
    });
  });

  it("imports into the owner's connection", async () => {
    await syncToTheEnd(clientOf(household.ownerId), household.connectionId);

    expect(
      await prisma.transaction.count({
        where: { account: { connectionId: household.connectionId } },
      })
    ).toBeGreaterThan(1);
  });
});
