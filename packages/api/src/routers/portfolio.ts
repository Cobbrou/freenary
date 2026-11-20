import prisma from "@freenary/db";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { balanceHistory, monthEndsBefore } from "../lib/balance-history";
import {
  currentAccountsOf,
  holdingsSummaryOf,
  netWorthOf,
} from "../lib/net-worth";
import { userCurrency } from "../lib/user-currency";

export const portfolioRouter = {
  getBalanceHistory: protectedProcedure
    .input(
      z.object({
        months: z.number().int().min(1).max(24),
        today: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const [firstMonthEnd] = monthEndsBefore(input.today, input.months);

      const [accounts, transactions, currency] = await Promise.all([
        prisma.bankAccount.findMany({
          select: { balanceMinor: true, currency: true, id: true },
          where: { connection: { userId } },
        }),
        prisma.transaction.findMany({
          select: { accountId: true, amount: true, date: true },
          where: {
            account: { connection: { userId } },
            date: { gt: firstMonthEnd },
          },
        }),
        userCurrency(userId),
      ]);

      return {
        currency,
        points: balanceHistory(
          accounts,
          transactions,
          currency,
          input.today,
          input.months
        ),
      };
    }),

  getOverview: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const [accounts, holdings, currency] = await Promise.all([
      prisma.bankAccount.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          balanceAt: true,
          balanceMinor: true,
          connection: { select: { institutionName: true } },
          currency: true,
          id: true,
          name: true,
          type: true,
        },
        where: { connection: { userId } },
      }),
      prisma.holding.findMany({
        select: {
          currency: true,
          id: true,
          label: true,
          unrealisedGainMinor: true,
          valuationMinor: true,
        },
        where: { account: { connection: { userId } } },
      }),
      userCurrency(userId),
    ]);

    return {
      accounts: accounts.map((account) => ({
        balanceMinor: account.balanceMinor,
        currency: account.currency,
        id: account.id,
        institutionName: account.connection.institutionName,
        name: account.name,
        type: account.type,
      })),
      currency,
      currentAccounts: currentAccountsOf(accounts),
      holdings: holdingsSummaryOf(holdings, currency),
      netWorth: netWorthOf(accounts, currency),
    };
  }),
};
