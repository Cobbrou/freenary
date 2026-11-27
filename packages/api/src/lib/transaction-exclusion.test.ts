import { beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";
import { createRouterClient } from "@orpc/server";
import { Effect } from "effect";

import {
  matchInternalTransfers,
  rematchInternalTransfers,
} from "../categorisation/internal-transfer";
import { refreshHolderNames } from "../categorisation/own-counterparty";
import {
  matchTransfersInRun,
  startPendingCategorisation,
} from "../categorisation/run";
import { mockProvider } from "../providers/mock/index";
import { mockSessionCode } from "../providers/mock/session";
import { appRouter } from "../routers/index";
import { codeOf, contextOf } from "../testing";
import { importAccountsInSeries } from "./bank-sync";
import {
  MAX_EXCLUSION_REASON_LENGTH,
  exclusionReasonOf,
} from "./exclusion-scope";
import { claimSyncRun } from "./sync-progress";
import type { SyncReporter } from "./sync-progress";
import {
  applyExclusions,
  displayedReasonOf,
  exclusionAfter,
  inheritedExclusionOf,
} from "./transaction-exclusion";

beforeAll(async () => {
  await startTestDatabase();
});

describe("exclusionAfter", () => {
  it("excludes a counted transaction alone or with its merchant", () => {
    expect(exclusionAfter(null, "transaction", true)).toBe("TRANSACTION");
    expect(exclusionAfter(null, "merchant", true)).toBe("MERCHANT");
    expect(exclusionAfter(null, "account", true)).toBe("ACCOUNT");
  });

  it("keeps the first reason a transaction was excluded for", () => {
    expect(exclusionAfter("TRANSACTION", "merchant", true)).toBe("TRANSACTION");
    expect(exclusionAfter("MERCHANT", "transaction", true)).toBe("MERCHANT");
    expect(exclusionAfter("ACCOUNT", "transaction", true)).toBe("ACCOUNT");
  });

  it("counts a transaction again only through the reason that excluded it", () => {
    expect(exclusionAfter("TRANSACTION", "transaction", false)).toBeNull();
    expect(exclusionAfter("MERCHANT", "merchant", false)).toBeNull();
    expect(exclusionAfter("MERCHANT", "transaction", false)).toBe("MERCHANT");
    expect(exclusionAfter("TRANSACTION", "merchant", false)).toBe(
      "TRANSACTION"
    );

    expect(exclusionAfter("ACCOUNT", "merchant", false)).toBe("ACCOUNT");
  });

  it("falls back to the account or merchant exclusion it still falls under", () => {
    expect(exclusionAfter("TRANSACTION", "transaction", false, "ACCOUNT")).toBe(
      "ACCOUNT"
    );
  });
});

describe("inheritedExclusionOf", () => {
  it("prefers the account over the merchant", () => {
    expect(
      inheritedExclusionOf({ accountExcluded: true, merchantExcluded: true })
    ).toBe("ACCOUNT");

    expect(
      inheritedExclusionOf({ accountExcluded: false, merchantExcluded: true })
    ).toBe("MERCHANT");

    expect(
      inheritedExclusionOf({ accountExcluded: false, merchantExcluded: false })
    ).toBeNull();
  });
});

describe("displayedReasonOf", () => {
  const reasons = {
    accountReason: "Joint account",
    merchantReason: "Reimbursed",
    transactionReason: "Gift",
  };

  it("shows the reason of whatever excluded the transaction", () => {
    expect(displayedReasonOf({ ...reasons, exclusion: "ACCOUNT" })).toBe(
      "Joint account"
    );

    expect(displayedReasonOf({ ...reasons, exclusion: "MERCHANT" })).toBe(
      "Reimbursed"
    );

    expect(displayedReasonOf({ ...reasons, exclusion: "TRANSACTION" })).toBe(
      "Gift"
    );

    expect(displayedReasonOf({ ...reasons, exclusion: null })).toBeNull();
  });
});

describe("exclusionReasonOf", () => {
  it("trims a reason and stores a blank one as none", () => {
    expect(exclusionReasonOf("  Joint account ")).toBe("Joint account");
    expect(exclusionReasonOf("   ")).toBeNull();
    expect(exclusionReasonOf(null)).toBeNull();
  });
});

const BOOKED_ON = new Date("2026-10-01T00:00:00.000Z");

const PERIOD = {
  from: new Date("2026-10-01T00:00:00.000Z"),
  to: new Date("2026-10-31T23:59:59.000Z"),
};

const createHousehold = async () => {
  const userId = `exclusion-${randomUUID()}`;

  await prisma.user.create({
    data: { email: `${userId}@example.test`, firstName: "Member", id: userId },
  });

  const connection = await prisma.bankConnection.create({
    data: {
      institutionName: "Mock Bank",
      provider: "mock",
      providerSessionId: mockSessionCode(BOOKED_ON),
      userId,
    },
  });

  const accountOf = (name: string, balanceMinor: number) =>
    prisma.bankAccount.create({
      data: {
        balanceMinor,
        connectionId: connection.id,
        currency: "EUR",
        name,
        providerAccountId: name,
        type: "CHECKING",
      },
    });

  const [own, joint] = await Promise.all([
    accountOf("own", 100_000),
    accountOf("joint", 40_000),
  ]);

  const spend = (accountId: string, amount: number, merchantKey: string) =>
    prisma.transaction.create({
      data: {
        accountId,
        amount,
        counterpartyName: merchantKey,
        currency: "EUR",
        date: BOOKED_ON,
        merchantKey,
        resolvedCategory: "groceries",
      },
    });

  const [ownGroceries, jointGroceries, jointNetflix] = await Promise.all([
    spend(own.id, -2000, "carrefour"),
    spend(joint.id, -5000, "carrefour"),
    spend(joint.id, -1500, "netflix"),
  ]);

  return {
    client: createRouterClient(appRouter, { context: contextOf(userId) }),
    connection,
    jointGroceries,
    jointId: joint.id,
    jointNetflix,
    ownGroceries,
    ownId: own.id,
    userId,
  };
};

const categorisationFinished = async (userId: string) => {
  const run = await prisma.syncRun.findUnique({ where: { userId } });

  if (run && run.finishedAt === null) {
    await Bun.sleep(50);
    await categorisationFinished(userId);
  }
};

const excludeAccountOf = async (
  household: Awaited<ReturnType<typeof createHousehold>>,
  input: Parameters<typeof household.client.budget.excludeAccount>[0]
) => {
  const outcome = await household.client.budget.excludeAccount(input);

  await categorisationFinished(household.userId);

  return outcome;
};

const listed = async (
  household: Awaited<ReturnType<typeof createHousehold>>
) => {
  const { totals, transactions } =
    await household.client.budget.getTransactions(PERIOD);

  return {
    byId: new Map(transactions.map((tx) => [tx.id, tx])),
    totals,
  };
};

describe("an excluded account", () => {
  it("keeps its transactions listed, with the reason, but out of every figure", async () => {
    const household = await createHousehold();

    expect(
      await excludeAccountOf(household, {
        accountId: household.jointId,
        excluded: true,
        reason: "  Joint account with Sam  ",
      })
    ).toEqual({
      excluded: true,
      exclusionReason: "Joint account with Sam",
      rematchStarted: true,
      updated: 2,
    });

    const { byId, totals } = await listed(household);

    expect(byId.get(household.jointGroceries.id)).toMatchObject({
      exclusion: "ACCOUNT",
      exclusionReason: "Joint account with Sam",
    });

    expect(byId.get(household.ownGroceries.id)).toMatchObject({
      exclusion: null,
      exclusionReason: null,
    });

    expect(totals).toMatchObject({ incoming: 0, outgoing: 2000 });

    const breakdown = await household.client.budget.getSpendingBreakdown({
      ...PERIOD,
      aggregation: "total",
    });

    expect(breakdown.categories).toEqual([
      expect.objectContaining({ amount: 2000, category: "groceries" }),
    ]);

    const overview = await household.client.portfolio.getOverview();

    expect(overview.netWorth.netWorthMinor).toBe(100_000);
    expect(overview.currentAccounts.balanceMinor).toBe(100_000);
    expect(
      overview.accounts.find((account) => account.id === household.jointId)
    ).toMatchObject({
      excluded: true,
      exclusionReason: "Joint account with Sam",
    });
  });

  it("counts its transactions again once included, keeping other exclusions", async () => {
    const household = await createHousehold();

    await household.client.budget.excludeMerchant({
      excluded: true,
      reason: "Paid back by Sam",
      transactionId: household.jointNetflix.id,
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
      reason: "Joint",
    });

    const before = await listed(household);

    expect(before.byId.get(household.jointNetflix.id)).toMatchObject({
      exclusion: "ACCOUNT",
      exclusionReason: "Joint",
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: false,
      reason: "ignored",
    });

    const { byId } = await listed(household);

    expect(byId.get(household.jointGroceries.id)).toMatchObject({
      exclusion: null,
      exclusionReason: null,
    });

    expect(byId.get(household.jointNetflix.id)).toMatchObject({
      exclusion: "MERCHANT",
      exclusionReason: "Paid back by Sam",
    });

    const account = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: household.jointId },
    });

    expect(account).toMatchObject({ excluded: false, exclusionReason: null });
  });

  it("falls back to the account when one of its transactions is included again", async () => {
    const household = await createHousehold();

    await household.client.budget.excludeTransaction({
      excluded: true,
      reason: "Birthday gift",
      transactionId: household.jointGroceries.id,
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
      reason: "Joint",
    });

    const before = await listed(household);

    expect(before.byId.get(household.jointGroceries.id)).toMatchObject({
      exclusion: "TRANSACTION",
      exclusionReason: "Birthday gift",
    });

    expect(
      await household.client.budget.excludeTransaction({
        excluded: false,
        transactionId: household.jointGroceries.id,
      })
    ).toEqual({ exclusion: "ACCOUNT", exclusionReason: "Joint", updated: 1 });
  });

  it("excludes the transactions synced into it later", async () => {
    const household = await createHousehold();

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
    });

    const late = await prisma.transaction.create({
      data: {
        accountId: household.jointId,
        amount: -900,
        currency: "EUR",
        date: BOOKED_ON,
      },
    });

    await applyExclusions(household.userId);

    expect(
      await prisma.transaction.findUniqueOrThrow({ where: { id: late.id } })
    ).toMatchObject({ exclusion: "ACCOUNT" });
  });
});

const stored = (id: string) =>
  prisma.transaction.findUniqueOrThrow({ where: { id } });

const reporter: SyncReporter = {
  accountFinished: () => Promise.resolve(),
  accountsDiscovered: () => Promise.resolve(),
  categorised: () => Promise.resolve(),
  categorisingStarted: () => Promise.resolve(),
  finished: () => Promise.resolve(),
  finishedWith: () => Promise.resolve(),
  heartbeat: () => Promise.resolve(),
  transactionsImported: () => Promise.resolve(),
};

const linkHousehold = async () => {
  const household = await createHousehold();

  await Promise.all([
    prisma.bankAccount.update({
      data: { iban: "FR7630006000011234567890189" },
      where: { id: household.ownId },
    }),
    prisma.bankAccount.update({
      data: { iban: "FR7630006000019876543210123" },
      where: { id: household.jointId },
    }),
  ]);

  const [toJoint, intoJoint] = await Promise.all([
    prisma.transaction.create({
      data: {
        accountId: household.ownId,
        amount: -3000,
        creditorAccountIban: "FR7630006000019876543210123",
        currency: "EUR",
        date: BOOKED_ON,
      },
    }),
    prisma.transaction.create({
      data: {
        accountId: household.jointId,
        amount: 3000,
        currency: "EUR",
        date: BOOKED_ON,
        debtorAccountIban: "FR7630006000011234567890189",
      },
    }),
  ]);

  await matchInternalTransfers(household.userId, null);

  return { ...household, intoJoint, toJoint };
};

const toggleJoint = (
  household: Awaited<ReturnType<typeof createHousehold>>,
  excluded: boolean
) => excludeAccountOf(household, { accountId: household.jointId, excluded });

const failingRates = () =>
  Promise.reject(new Error("exchange rates unavailable"));

describe("an excluded account over time", () => {
  it("stays excluded when one of its merchants changes after a re-sync", async () => {
    const household = await createHousehold();

    await household.client.budget.excludeMerchant({
      excluded: true,
      transactionId: household.jointNetflix.id,
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
    });

    await prisma.transaction.update({
      data: { merchantKey: "netflix-com" },
      where: { id: household.jointNetflix.id },
    });

    await applyExclusions(household.userId);

    expect(await stored(household.jointNetflix.id)).toMatchObject({
      exclusion: "ACCOUNT",
    });
  });

  it("falls back to the account, with its reason, when its merchant is included again", async () => {
    const household = await createHousehold();

    await household.client.budget.excludeMerchant({
      excluded: true,
      reason: "Paid back",
      transactionId: household.jointNetflix.id,
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
      reason: "Joint",
    });

    expect(
      await household.client.budget.excludeMerchant({
        excluded: false,
        transactionId: household.jointNetflix.id,
      })
    ).toEqual({ exclusion: "ACCOUNT", exclusionReason: "Joint", updated: 0 });

    const { byId } = await listed(household);

    expect(byId.get(household.jointNetflix.id)).toMatchObject({
      exclusion: "ACCOUNT",
      exclusionReason: "Joint",
    });
  });

  it("excludes the transactions a bank sync writes into it", async () => {
    const household = await createHousehold();

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
    });

    const joint = {
      currency: "EUR",
      id: household.jointId,
      providerAccountId: "joint",
      type: "CHECKING",
    };

    const failures = await Effect.runPromise(
      importAccountsInSeries(
        {
          connection: { ...household.connection, accounts: [joint] },
          deleteTransactions: (where) =>
            prisma.transaction.deleteMany({ where }),
          provider: {
            ...mockProvider,
            fetchHoldings: undefined,
            fetchTransactions: () =>
              Promise.resolve({
                deletedTransactionIds: [],
                transactions: [
                  {
                    amountMinor: -4200,
                    bookingDate: "2026-10-02",
                    creditorName: "Bakery",
                    currency: "EUR",
                    providerTransactionId: "synced-into-joint",
                    remittanceLines: ["CB BAKERY"],
                    status: "BOOK",
                  },
                ],
              }),
          },
          reporter,
          user: null,
          window: { dateFrom: "2026-10-01", dateTo: "2026-10-26" },
        },
        [joint]
      )
    );

    expect(failures).toEqual([]);

    expect(
      await prisma.transaction.findFirstOrThrow({
        where: {
          accountId: household.jointId,
          providerTransactionId: "synced-into-joint",
        },
      })
    ).toMatchObject({ exclusion: "ACCOUNT" });
  });

  it("leaves its balance out of the balance history and the recurring summary", async () => {
    const household = await createHousehold();
    const today = new Date("2026-10-20T00:00:00.000Z");
    const history = () =>
      household.client.portfolio.getBalanceHistory({ months: 1, today });

    const before = await history();

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
    });

    const after = await history();

    expect(before.points?.at(-1)?.balanceMinor).toBe(140_000);
    expect(after.points?.at(-1)?.balanceMinor).toBe(100_000);

    const recurring = await household.client.budget.getRecurring();

    expect(recurring.availableBalanceMinor).toBe(100_000);
  });

  it("counts money moved into it as money going out", async () => {
    const household = await linkHousehold();

    expect(await stored(household.toJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });

    await toggleJoint(household, true);

    expect(await stored(household.toJoint.id)).toMatchObject({
      isInternalTransfer: false,
    });

    expect(await stored(household.intoJoint.id)).toMatchObject({
      exclusion: "ACCOUNT",
      isInternalTransfer: false,
    });

    const { totals } = await listed(household);

    expect(totals).toMatchObject({
      incoming: 0,
      outgoing: 5000,
    });

    await toggleJoint(household, false);

    expect(await stored(household.toJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });
  });

  it("forgets the names it learned from moves with it, but not the ones the member declared", async () => {
    const household = await createHousehold();

    await Promise.all([
      prisma.bankAccount.update({
        data: { iban: "FR7630006000011234567890189" },
        where: { id: household.ownId },
      }),
      prisma.bankAccount.update({
        data: { iban: "FR7630006000019876543210123" },
        where: { id: household.jointId },
      }),
      prisma.ownCounterparty.create({
        data: {
          isOwn: true,
          key: "ALICE MARTIN",
          kind: "name",
          source: "member",
          userId: household.userId,
        },
      }),
    ]);

    const [toJoint, , toAlice] = await Promise.all([
      prisma.transaction.create({
        data: {
          accountId: household.ownId,
          amount: -3000,
          counterpartyName: "M ET MME DUPONT",
          creditorAccountIban: "FR7630006000019876543210123",
          currency: "EUR",
          date: BOOKED_ON,
        },
      }),
      prisma.transaction.create({
        data: {
          accountId: household.jointId,
          amount: 3000,
          counterpartyName: "Jean Dupont",
          currency: "EUR",
          date: BOOKED_ON,
          debtorAccountIban: "FR7630006000011234567890189",
        },
      }),
      prisma.transaction.create({
        data: {
          accountId: household.ownId,
          amount: -1000,
          counterpartyName: "Alice Martin",
          currency: "EUR",
          date: BOOKED_ON,
        },
      }),
    ]);

    await matchInternalTransfers(household.userId, null);

    const learned = () =>
      prisma.ownCounterparty.findMany({
        select: { key: true, source: true },
        where: { userId: household.userId },
      });

    expect(await learned()).toEqual(
      expect.arrayContaining([
        { key: "DUPONT ET", source: "pairing" },
        { key: "DUPONT JEAN", source: "pairing" },
      ])
    );

    await toggleJoint(household, true);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: false,
    });

    expect(await learned()).toEqual([
      { key: "ALICE MARTIN", source: "member" },
    ]);

    await matchInternalTransfers(household.userId, null);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: false,
    });

    expect(await stored(toAlice.id)).toMatchObject({
      isInternalTransfer: true,
      resolutionStage: "own-counterparty",
    });

    const { totals } = await listed(household);

    expect(totals).toMatchObject({ outgoing: 5000 });

    await toggleJoint(household, false);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: true,
      resolutionStage: "internal-transfer",
    });

    expect(await learned()).toEqual(
      expect.arrayContaining([
        { key: "ALICE MARTIN", source: "member" },
        { key: "DUPONT ET", source: "pairing" },
      ])
    );
  });

  it("leaves a transfer the member marked by hand untouched", async () => {
    const household = await createHousehold();
    const savings = await prisma.transaction.create({
      data: {
        accountId: household.ownId,
        amount: -4000,
        category: "internal-transfer",
        categoryOverride: true,
        currency: "EUR",
        date: BOOKED_ON,
        isInternalTransfer: true,
        resolutionStage: "internal-transfer",
      },
    });

    const before = await stored(savings.id);

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
    });

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: false,
    });

    expect(await stored(savings.id)).toMatchObject(before);
  });

  it("keeps the transfers it had matched when matching them again fails", async () => {
    const household = await linkHousehold();
    const before = await stored(household.toJoint.id);

    await prisma.bankAccount.update({
      data: { excluded: true },
      where: { id: household.jointId },
    });

    await prisma.syncRun.create({
      data: {
        finishedAt: BOOKED_ON,
        phase: "FINISHED",
        transfersStale: true,
        userId: household.userId,
      },
    });

    expect(
      await matchTransfersInRun(household.userId, null, (userId) =>
        rematchInternalTransfers(userId, { loadRates: failingRates })
      )
    ).toEqual({ hasRematchFailed: true });

    expect(await stored(household.toJoint.id)).toMatchObject(before);
    expect(await stored(household.intoJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });

    expect(
      await prisma.syncRun.findUniqueOrThrow({
        where: { userId: household.userId },
      })
    ).toMatchObject({ transfersStale: true });
  });

  it("matches the transfers again once a run already going finishes", async () => {
    const household = await linkHousehold();

    await claimSyncRun(household.userId, "IMPORTING");

    await household.client.budget.excludeAccount({
      accountId: household.jointId,
      excluded: true,
    });

    expect(await stored(household.toJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });

    await prisma.syncRun.update({
      data: { finishedAt: new Date(), phase: "FINISHED" },
      where: { userId: household.userId },
    });

    await startPendingCategorisation(household.userId);
    await categorisationFinished(household.userId);

    expect(await stored(household.toJoint.id)).toMatchObject({
      isInternalTransfer: false,
    });
  });
});

const ownerNames = (userId: string) =>
  prisma.ownCounterparty.findMany({
    orderBy: { key: "asc" },
    select: { key: true, source: true },
    where: { userId },
  });

const spendTo = (accountId: string, counterpartyName: string) =>
  prisma.transaction.create({
    data: {
      accountId,
      amount: -1000,
      counterpartyName,
      currency: "EUR",
      date: BOOKED_ON,
    },
  });

describe("the names of the account owners", () => {
  it("keeps a transfer to a name learned from a confirmed pair after matching again", async () => {
    const household = await createHousehold();

    await Promise.all([
      prisma.bankAccount.update({
        data: { iban: "FR7630006000011234567890189" },
        where: { id: household.ownId },
      }),
      prisma.bankAccount.update({
        data: { iban: "FR7630006000019876543210123" },
        where: { id: household.jointId },
      }),
    ]);

    await Promise.all([
      prisma.transaction.create({
        data: {
          accountId: household.ownId,
          amount: -3000,
          creditorAccountIban: "FR7630006000019876543210123",
          currency: "EUR",
          date: BOOKED_ON,
        },
      }),
      prisma.transaction.create({
        data: {
          accountId: household.jointId,
          amount: 3000,
          counterpartyName: "Jean Dupont",
          currency: "EUR",
          date: BOOKED_ON,
        },
      }),
    ]);

    const toJean = await spendTo(household.ownId, "Jean Dupont");

    await matchInternalTransfers(household.userId, null);

    expect(await stored(toJean.id)).toMatchObject({
      isInternalTransfer: true,
      resolutionStage: "own-counterparty",
    });

    await rematchInternalTransfers(household.userId);

    expect(await stored(toJean.id)).toMatchObject({
      isInternalTransfer: true,
      resolutionStage: "own-counterparty",
    });
  });

  it("keeps a holder name the transfers had already taught it", async () => {
    const household = await createHousehold();

    await prisma.ownCounterparty.create({
      data: {
        isOwn: true,
        key: "DUPONT JEAN",
        kind: "name",
        source: "pairing",
        userId: household.userId,
      },
    });

    await prisma.bankAccount.update({
      data: { holderNameKeys: ["DUPONT JEAN"] },
      where: { id: household.ownId },
    });

    expect(await refreshHolderNames(household.userId)).toBe(0);

    await rematchInternalTransfers(household.userId);

    expect(await ownerNames(household.userId)).toEqual([
      { key: "DUPONT JEAN", source: "holder" },
    ]);
  });

  it("counts a holder name an account you count reports again", async () => {
    const household = await createHousehold();

    await prisma.bankAccount.update({
      data: { excluded: true, holderNameKeys: ["DUPONT ET"] },
      where: { id: household.jointId },
    });

    await prisma.ownCounterparty.create({
      data: {
        isOwn: true,
        key: "DUPONT ET",
        kind: "name",
        source: "holder",
        userId: household.userId,
      },
    });

    expect(await refreshHolderNames(household.userId)).toBe(1);
    expect(await ownerNames(household.userId)).toEqual([]);

    await prisma.bankAccount.update({
      data: { holderNameKeys: ["DUPONT ET"] },
      where: { id: household.ownId },
    });

    expect(await refreshHolderNames(household.userId)).toBe(1);
    expect(await ownerNames(household.userId)).toEqual([
      { key: "DUPONT ET", source: "holder" },
    ]);
  });

  it("forgets the holder names only an excluded account reports", async () => {
    const household = await createHousehold();

    await Promise.all([
      prisma.bankAccount.update({
        data: { holderNameKeys: ["DUPONT JEAN"] },
        where: { id: household.ownId },
      }),
      prisma.bankAccount.update({
        data: { holderNameKeys: ["DUPONT ET", "DUPONT JEAN"] },
        where: { id: household.jointId },
      }),
    ]);

    expect(await refreshHolderNames(household.userId)).toBe(2);
    expect(await refreshHolderNames(household.userId)).toBe(0);

    const toJoint = await spendTo(household.ownId, "M ET MME DUPONT");

    await matchInternalTransfers(household.userId, null);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });

    await toggleJoint(household, true);

    expect(await ownerNames(household.userId)).toEqual([
      { key: "DUPONT JEAN", source: "holder" },
    ]);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: false,
    });

    await prisma.bankAccount.update({
      data: { holderNameKeys: ["DUPONT ET", "DUPONT JEAN"] },
      where: { id: household.jointId },
    });

    expect(await refreshHolderNames(household.userId)).toBe(0);

    expect(await ownerNames(household.userId)).toEqual([
      { key: "DUPONT JEAN", source: "holder" },
    ]);

    await toggleJoint(household, false);

    expect(await ownerNames(household.userId)).toEqual([
      { key: "DUPONT ET", source: "holder" },
      { key: "DUPONT JEAN", source: "holder" },
    ]);

    expect(await stored(toJoint.id)).toMatchObject({
      isInternalTransfer: true,
    });
  });
});

describe("an exclusion reason", () => {
  it("is kept when an exclusion is confirmed without one, and cleared by an explicit null", async () => {
    const household = await createHousehold();
    const { budget } = household.client;

    await excludeAccountOf(household, {
      accountId: household.jointId,
      excluded: true,
      reason: "Joint",
    });

    expect(
      await budget.excludeAccount({
        accountId: household.jointId,
        excluded: true,
      })
    ).toMatchObject({ exclusionReason: "Joint", rematchStarted: false });

    await budget.excludeTransaction({
      excluded: true,
      reason: "Gift",
      transactionId: household.ownGroceries.id,
    });

    expect(
      await budget.excludeTransaction({
        excluded: true,
        transactionId: household.ownGroceries.id,
      })
    ).toMatchObject({ exclusion: "TRANSACTION", exclusionReason: "Gift" });

    expect(
      await budget.excludeTransaction({
        excluded: true,
        reason: null,
        transactionId: household.ownGroceries.id,
      })
    ).toMatchObject({ exclusion: "TRANSACTION", exclusionReason: null });

    await budget.excludeTransaction({
      excluded: false,
      transactionId: household.ownGroceries.id,
    });

    await budget.excludeMerchant({
      excluded: true,
      reason: "Shared",
      transactionId: household.ownGroceries.id,
    });

    expect(
      await budget.excludeMerchant({
        excluded: true,
        transactionId: household.ownGroceries.id,
      })
    ).toMatchObject({ exclusion: "MERCHANT", exclusionReason: "Shared" });

    expect(
      await budget.excludeAccount({
        accountId: household.jointId,
        excluded: true,
        reason: null,
      })
    ).toMatchObject({ exclusionReason: null });
  });

  it("is stored on a transaction and updated in place", async () => {
    const household = await createHousehold();
    const transactionId = household.ownGroceries.id;

    await household.client.budget.excludeTransaction({
      excluded: true,
      transactionId,
    });

    expect(
      await household.client.budget.excludeTransaction({
        excluded: true,
        reason: "Work expense",
        transactionId,
      })
    ).toEqual({
      exclusion: "TRANSACTION",
      exclusionReason: "Work expense",
      updated: 1,
    });

    expect(
      await household.client.budget.excludeTransaction({
        excluded: false,
        transactionId,
      })
    ).toEqual({ exclusion: null, exclusionReason: null, updated: 1 });

    expect(
      await prisma.transaction.findUniqueOrThrow({
        where: { id: transactionId },
      })
    ).toMatchObject({ exclusion: null, exclusionReason: null });
  });

  it("is stored on a merchant and shown on each of its transactions", async () => {
    const household = await createHousehold();

    await household.client.budget.excludeMerchant({
      excluded: true,
      reason: "Shared shopping",
      transactionId: household.ownGroceries.id,
    });

    const { byId } = await listed(household);

    for (const tx of [household.ownGroceries, household.jointGroceries]) {
      expect(byId.get(tx.id)).toMatchObject({
        exclusion: "MERCHANT",
        exclusionReason: "Shared shopping",
      });
    }
  });

  it("is refused past its maximum length", async () => {
    const household = await createHousehold();

    expect(
      await codeOf(
        excludeAccountOf(household, {
          accountId: household.jointId,
          excluded: true,
          reason: "x".repeat(MAX_EXCLUSION_REASON_LENGTH + 1),
        })
      )
    ).toBe("BAD_REQUEST");
  });

  it("is not found on another member's account", async () => {
    const household = await createHousehold();
    const intruder = await createHousehold();

    expect(
      await codeOf(
        intruder.client.budget.excludeAccount({
          accountId: household.jointId,
          excluded: true,
        })
      )
    ).toBe("NOT_FOUND");
  });
});
