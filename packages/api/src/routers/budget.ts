import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
  cadenceWindow,
  detectRecurring,
  detectRecurringExpenses,
  stillRecurring,
  trailingCadence,
  trailingYear,
} from "../categorisation/recurrence";
import { startRecategorisation } from "../categorisation/run";
import {
  deleteUserOverride,
  upsertUserOverride,
  userCategoryUpdate,
} from "../categorisation/user-override";
import { protectedProcedure } from "../index";
import { cashFlowAccountsOf } from "../lib/account-types";
import { accountsSummary } from "../lib/accounts-summary";
import { startAccountSync } from "../lib/bank-sync";
import {
  budgetLinesOf,
  budgetVsActualOf,
  cashFlow,
  convertedTotals,
  fixedVsVariableOf,
  merchantTotals,
  outgoingBudgetLines,
  outgoingByCategory,
  outgoingRows,
  periodInput,
  periodRows,
  sankeyOf,
  spendingBreakdownOf,
  trailingCalendarMonthKeys,
  userOutgoingByCategory,
  zeroFilledMonths,
} from "../lib/budget-aggregates";
import { monthSpan } from "../lib/budget-planned";
import { readSyncOutcome, readSyncProgress } from "../lib/sync-progress";
import type { BudgetPipelineReason } from "../lib/sync-progress";
import { SPENDING_CATEGORIES } from "../lib/taxonomy";
import {
  effectiveCategory,
  pipelineCategory,
} from "../lib/transaction-category";
import { transactionFilterConditions } from "../lib/transaction-filter-conditions";
import {
  MAX_SEARCH_TEXT_LENGTH,
  transactionFiltersSchema,
} from "../lib/transaction-filters";
import { transactionPage } from "../lib/transaction-page";
import { userBudgetMonthRule } from "../lib/user-budget-month";
import { userConverter, userCurrency } from "../lib/user-currency";
import { spendingWeeksStart, weeklySpending } from "../lib/weekly-spending";
import { categorySuggestionProcedures } from "./category-suggestions";
import { savedFilterProcedures } from "./saved-filters";

export const budgetRouter = {
  ...categorySuggestionProcedures,
  ...savedFilterProcedures,
  getAccounts: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const accounts = await prisma.bankAccount.findMany({
      select: {
        connection: {
          select: { institutionName: true },
        },
        iban: true,
        id: true,
        name: true,
      },
      where: {
        connection: { userId },
      },
    });

    const [transactionDateBounds, currency] = await Promise.all([
      prisma.transaction.aggregate({
        _max: { date: true },
        _min: { date: true },
        where: { account: { connection: { userId } } },
      }),
      userCurrency(userId),
    ]);

    return {
      accounts: accounts.map((a) => ({
        iban: a.iban,
        id: a.id,
        institutionName: a.connection.institutionName,
        name: a.name,
      })),
      currency,
      firstTransactionDate: transactionDateBounds._min.date,
      hasAccounts: accounts.length > 0,
      lastTransactionDate: transactionDateBounds._max.date,
    };
  }),

  getBudgetVsActual: protectedProcedure
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const converter = await userConverter(userId, from, to);
      const [lines, actual] = await Promise.all([
        budgetLinesOf(userId),
        userOutgoingByCategory(userId, { aggregation, from, to }, converter),
      ]);

      return {
        ...budgetVsActualOf(lines, actual.byCategory, input),
        currency: converter.currency,
        unconvertedCount: actual.unconvertedCount,
      };
    }),

  getCashFlow: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        grain: z.enum(["day", "week", "month"]).optional(),
        to: z.coerce.date(),
      })
    )
    .handler(({ context, input }) => cashFlow(context.session.user.id, input)),

  getFixedVsVariable: protectedProcedure
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const converter = await userConverter(userId, from, to);
      const [outgoing, recurring, rule] = await Promise.all([
        outgoingRows(userId, from, to, converter),
        detectRecurringExpenses(userId, cadenceWindow(from, to), converter),
        userBudgetMonthRule(userId),
      ]);

      return {
        ...fixedVsVariableOf(
          outgoing.rows,
          outgoingByCategory(outgoing.rows, { aggregation, from, rule, to }),
          recurring
        ),
        currency: converter.currency,
        unconvertedCount: outgoing.unconvertedCount,
      };
    }),

  getMerchants: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1).optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        from: z.coerce.date(),
        limit: z.number().int().min(1).max(100).default(30),
        search: z.string().max(MAX_SEARCH_TEXT_LENGTH).optional(),
        to: z.coerce.date(),
      })
    )
    .handler(({ context, input }) =>
      merchantTotals(context.session.user.id, input)
    ),

  getPeriodOverview: protectedProcedure
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const converter = await userConverter(userId, from, to);
      const [counted, lines, recurring, rule] = await Promise.all([
        periodRows(userId, from, to, converter),
        budgetLinesOf(userId),
        detectRecurringExpenses(userId, cadenceWindow(from, to), converter),
        userBudgetMonthRule(userId),
      ]);

      const { currency } = converter;
      const { rows, unconvertedCount } = counted;
      const period = { aggregation, from, rule, to };
      const outgoing = rows.filter((row) => row.amount < 0);
      const byCategory = outgoingByCategory(outgoing, period);

      return {
        budgetVsActual: {
          ...budgetVsActualOf(lines, byCategory, input),
          currency,
          unconvertedCount,
        },
        fixedVsVariable: {
          ...fixedVsVariableOf(outgoing, byCategory, recurring),
          currency,
          unconvertedCount,
        },
        sankey: { ...sankeyOf(rows, period), currency, unconvertedCount },
        spendingBreakdown: {
          ...spendingBreakdownOf(byCategory),
          currency,
          unconvertedCount,
        },
      };
    }),

  getRecurring: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const asOf = new Date();
    const observed = trailingYear(asOf);

    const cadence = trailingCadence(asOf);
    const [accounts, converter] = await Promise.all([
      prisma.bankAccount.findMany({
        select: {
          balanceAt: true,
          balanceMinor: true,
          balances: {
            select: { balanceAt: true, balanceMinor: true, currency: true },
          },
          currency: true,
          type: true,
        },
        where: { connection: { userId } },
      }),
      userConverter(userId, cadence.from, asOf),
    ]);

    const { availableBalanceMinor, currency, unconvertedBalanceCount } =
      accountsSummary(accounts, converter, asOf);

    const incomingWhere: Prisma.TransactionWhereInput = {
      account: cashFlowAccountsOf(userId),
      amount: { gt: 0 },
      date: { gte: observed.from, lte: observed.to },
      isInternalTransfer: false,
    };

    const [detected, lines, incomingTotals, firstIncomingRow] =
      await Promise.all([
        detectRecurring(userId, cadence, converter, asOf),
        budgetLinesOf(userId),
        convertedTotals(incomingWhere, converter),
        prisma.transaction.aggregate({
          _min: { date: true },
          where: incomingWhere,
        }),
      ]);

    const outgoingLines = outgoingBudgetLines(lines);
    const plannedOutgoingMinor =
      outgoingLines.length > 0
        ? outgoingLines.reduce((sum, line) => sum + line.amount, 0)
        : null;

    const firstIncoming = firstIncomingRow._min.date;
    const monthlyIncomeMinor =
      firstIncoming === null
        ? null
        : Math.round(
            incomingTotals.incoming / monthSpan(firstIncoming, observed.to)
          );

    const live = detected.expenses.filter((expense) =>
      stillRecurring(expense, asOf)
    );

    return {
      asOf: asOf.toISOString(),
      availableBalanceMinor,
      currency,
      items: live.map((expense) => ({
        amountSpread: expense.amountSpread,
        category: expense.category,
        confidence: expense.confidence,
        currency: expense.currency,
        frequency: expense.frequency,
        intervalDays: expense.intervalDays,
        kind: expense.kind,
        lastSeen: expense.lastSeen.toISOString(),
        merchantKey: expense.merchantKey,
        merchantName: expense.merchantName,
        nextExpected: expense.nextExpected.toISOString(),
        occurrences: expense.occurrences,
        reportingAmountMinor: expense.reportingAmountMinor,
        typicalAmountMinor: expense.typicalAmountMinor,
      })),
      monthly: zeroFilledMonths(
        detected.months,
        trailingCalendarMonthKeys(asOf)
      ),
      monthlyIncomeMinor,
      plannedOutgoingMinor,
      unconvertedBalanceCount,
      unconvertedCount:
        detected.unconvertedCount + incomingTotals.unconvertedCount,
    };
  }),

  getRecurringExpenses: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const asOf = new Date();
    const cadence = trailingCadence(asOf);
    const detected = await detectRecurringExpenses(
      userId,
      cadence,
      await userConverter(userId, cadence.from, asOf)
    );

    const live = detected.filter((e) => stillRecurring(e, asOf));

    return {
      expenses: live.map((e) => ({
        category: e.category,
        currency: e.currency,
        frequency: e.frequency,
        intervalDays: e.intervalDays,
        lastSeen: e.lastSeen.toISOString(),
        merchantKey: e.merchantKey,
        merchantName: e.merchantName,
        nextExpected: e.nextExpected.toISOString(),
        occurrences: e.occurrences,
        reportingAmountMinor: e.reportingAmountMinor,
        typicalAmountMinor: e.typicalAmountMinor,
      })),
    };
  }),

  getSankeyData: protectedProcedure
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const converter = await userConverter(userId, input.from, input.to);
      const [counted, rule] = await Promise.all([
        periodRows(userId, input.from, input.to, converter),
        userBudgetMonthRule(userId),
      ]);

      return {
        ...sankeyOf(counted.rows, { ...input, rule }),
        currency: converter.currency,
        unconvertedCount: counted.unconvertedCount,
      };
    }),

  getSpendingBreakdown: protectedProcedure
    .input(periodInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const converter = await userConverter(userId, input.from, input.to);
      const outgoing = await userOutgoingByCategory(userId, input, converter);

      return {
        ...spendingBreakdownOf(outgoing.byCategory),
        currency: converter.currency,
        unconvertedCount: outgoing.unconvertedCount,
      };
    }),

  getSpendingByWeek: protectedProcedure
    .input(
      z.object({
        to: z.coerce.date(),
        weeks: z.number().int().min(1).max(26),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const from = spendingWeeksStart(input.to, input.weeks);
      const converter = await userConverter(userId, from, input.to);
      const { rows, unconvertedCount } = await outgoingRows(
        userId,
        from,
        input.to,
        converter
      );

      return {
        currency: converter.currency,
        unconvertedCount,
        weeks: weeklySpending(
          rows.map((row) => ({
            amount: row.amount,
            category: effectiveCategory(row),
            date: row.date,
          })),
          input.to,
          input.weeks
        ),
      };
    }),

  getSyncOutcome: protectedProcedure
    .input(z.object({ startedAt: z.coerce.date() }))
    .handler(async ({ context, input }) => {
      const outcome = await readSyncOutcome(
        context.session.user.id,
        input.startedAt
      );

      if (outcome === "running") {
        return null;
      }

      if (outcome === "lost") {
        throw new ORPCError("NOT_FOUND", {
          message: "The sync run ended without an outcome",
        });
      }

      // SAFETY: only syncAccounts writes failures, and it writes these.
      const failures = outcome.failures as BudgetPipelineReason[];

      return {
        categorised: outcome.categorised,
        failures,
        success: failures.every(
          (failure) => failure.kind !== "connection-sync"
        ),
      };
    }),

  getSyncStatus: protectedProcedure.handler(({ context }) =>
    readSyncProgress(context.session.user.id)
  ),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1).optional(),
        cursor: z.string().optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        filters: transactionFiltersSchema.optional(),
        from: z.coerce.date(),
        limit: z.number().int().min(1).max(100).default(50),
        search: z.string().max(MAX_SEARCH_TEXT_LENGTH).optional(),
        sort: z.enum(["date", "amount"]).default("date"),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const {
        accountId,
        cursor,
        direction,
        filters,
        from,
        limit,
        search,
        sort,
        to,
      } = input;

      const dateFilter = { gte: from, lte: to };
      let directionFilter: { gt: number } | { lt: number } | undefined;

      if (direction === "incoming") {
        directionFilter = { gt: 0 };
      } else if (direction === "outgoing") {
        directionFilter = { lt: 0 };
      }

      const conditions: Prisma.TransactionWhereInput[] = [];

      if (search) {
        conditions.push({
          OR: [
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              counterpartyName: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        });
      }

      const converter = await userConverter(userId, from, to);

      conditions.push(
        ...transactionFilterConditions(filters ?? [], converter.currency)
      );

      const baseWhere: Prisma.TransactionWhereInput = {
        account: { connection: { userId } },
        accountId,
        amount: directionFilter,
        date: dateFilter,
      };

      if (conditions.length > 0) {
        baseWhere.AND = conditions;
      }

      const largestAmountFirst = direction === "incoming" ? "desc" : "asc";
      const findManyOpts: Prisma.TransactionFindManyArgs = {
        orderBy:
          sort === "amount"
            ? [{ amount: largestAmountFirst }, { id: "desc" }]
            : [{ date: "desc" }, { id: "desc" }],
        select: {
          amount: true,
          category: true,
          counterpartyName: true,
          currency: true,
          date: true,
          description: true,
          exchangeFeeMinor: true,
          id: true,
          isInternalTransfer: true,
          normalisedDescriptor: true,
          originalAmount: true,
          originalCurrency: true,
          resolvedCategory: true,
        },
        take: limit + 1,
        where: baseWhere,
      };

      if (cursor) {
        findManyOpts.cursor = { id: cursor };
        findManyOpts.skip = 1;
      }

      const [fetched, totals] = await Promise.all([
        prisma.transaction.findMany(findManyOpts),
        cursor ? null : convertedTotals(baseWhere, converter),
      ]);

      const { nextCursor, transactions } = transactionPage(fetched, limit);

      return {
        currency: converter.currency,
        nextCursor,
        totals,
        transactions: transactions.map((t) => ({
          amount: t.amount,
          category: effectiveCategory(t),
          counterpartyName: t.counterpartyName,
          currency: t.currency,
          date: t.date.toISOString(),
          derivedCategory: pipelineCategory(t),
          description: t.description,
          exchangeFeeMinor: t.exchangeFeeMinor,
          id: t.id,
          isInternalTransfer: t.isInternalTransfer,
          normalisedDescriptor: t.normalisedDescriptor,
          originalAmount: t.originalAmount,
          originalCurrency: t.originalCurrency,
        })),
      };
    }),

  recategorise: protectedProcedure.handler(async ({ context }) => ({
    startedAt: await startRecategorisation(context.session.user.id),
  })),

  syncAccounts: protectedProcedure
    .input(
      z
        .object({
          connectionId: z.string().optional(),
          force: z.boolean().optional(),
        })
        .optional()
    )
    .handler(async ({ context, input }) => ({
      startedAt: await startAccountSync(context.session.user.id, {
        connectionId: input?.connectionId,
        force: input?.force ?? false,
      }),
    })),

  updateTransactionCategory: protectedProcedure
    .input(
      z.object({
        category: z.enum(SPENDING_CATEGORIES).nullable(),
        transactionId: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const tx = await prisma.transaction.findFirst({
        select: {
          category: true,
          counterpartyName: true,
          id: true,
          isInternalTransfer: true,
          merchantKey: true,
          resolvedCategory: true,
        },
        where: {
          account: { connection: { userId } },
          id: input.transactionId,
        },
      });

      if (!tx) {
        throw new ORPCError("NOT_FOUND", {
          message: "Transaction not found",
        });
      }

      const additionalUpdated = await prisma.$transaction(async (db) => {
        await db.transaction.update({
          data: userCategoryUpdate(input.category, tx.isInternalTransfer),
          where: { id: input.transactionId },
        });

        if (!tx.merchantKey) {
          return 0;
        }

        if (input.category === null) {
          await deleteUserOverride(userId, tx.merchantKey, db);

          const siblingsCleared = await db.transaction.updateMany({
            data: { category: null },
            where: {
              account: { connection: { userId } },
              categoryOverride: false,
              id: { not: input.transactionId },
              merchantKey: tx.merchantKey,
            },
          });

          return siblingsCleared.count;
        }

        await upsertUserOverride(
          userId,
          tx.merchantKey,
          input.category,
          tx.counterpartyName,
          db
        );

        const siblingsPropagated = await db.transaction.updateMany({
          data: { category: input.category },
          where: {
            account: { connection: { userId } },
            categoryOverride: false,
            id: { not: input.transactionId },
            merchantKey: tx.merchantKey,
          },
        });

        return siblingsPropagated.count;
      });

      const updated = await prisma.transaction.findUniqueOrThrow({
        select: {
          category: true,
          resolvedCategory: true,
        },
        where: { id: input.transactionId },
      });

      return {
        additionalUpdated,
        category: effectiveCategory(updated),
        derivedCategory: pipelineCategory(updated),
      };
    }),
};
