import prisma from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { MAX_ACCOUNT_NAME_LENGTH } from "../lib/account-name";
import { countedAccountsOf } from "../lib/account-types";
import { balancesOf } from "../lib/accounts-summary";
import {
  balanceHistory,
  monthEndsBefore,
  unconvertedHistoryCurrencies,
} from "../lib/balance-history";
import {
  currentAccountsOf,
  holdingsSummaryOf,
  netWorthOf,
} from "../lib/net-worth";
import { userConverter } from "../lib/user-currency";

const BALANCES_SELECT = {
  select: { balanceAt: true, balanceMinor: true, currency: true },
} as const;

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

      const [accounts, transactions, converter] = await Promise.all([
        prisma.bankAccount.findMany({
          select: {
            balanceMinor: true,
            balances: BALANCES_SELECT,
            currency: true,
            id: true,
            type: true,
          },
          where: countedAccountsOf(userId),
        }),
        prisma.transaction.findMany({
          select: { accountId: true, amount: true, currency: true, date: true },
          where: {
            account: countedAccountsOf(userId),
            date: { gt: firstMonthEnd },
          },
        }),
        userConverter(userId, firstMonthEnd ?? input.today, input.today),
      ]);

      return {
        currency: converter.currency,
        points: balanceHistory(
          accounts,
          transactions,
          converter,
          input.today,
          input.months
        ),
        ratesAsOf: converter.ratesAsOf?.toISOString() ?? null,
        unconvertedCurrencies: unconvertedHistoryCurrencies(
          accounts,
          converter,
          input.today
        ),
      };
    }),

  getOverview: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const now = new Date();
    const [accounts, holdings, converter] = await Promise.all([
      prisma.bankAccount.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          balanceAt: true,
          balanceMinor: true,
          balances: BALANCES_SELECT,
          connection: { select: { institutionName: true } },
          currency: true,
          customName: true,
          excluded: true,
          exclusionReason: true,
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
        where: { account: countedAccountsOf(userId) },
      }),
      userConverter(userId, now, now),
    ]);

    return {
      accounts: accounts.map((account) => ({
        balanceMinor: account.balanceMinor,
        balances: balancesOf(account).map((held) => ({
          balanceMinor: held.balanceMinor,
          convertedBalanceMinor: converter.convert(
            held.balanceMinor,
            held.currency,
            now
          ),
          currency: held.currency,
        })),
        bankName: account.name,
        currency: account.currency,
        customName: account.customName,
        excluded: account.excluded,
        exclusionReason: account.exclusionReason,
        id: account.id,
        institutionName: account.connection.institutionName,
        name: account.customName ?? account.name,
        type: account.type,
      })),
      currency: converter.currency,
      currentAccounts: currentAccountsOf(accounts, converter, now),
      holdings: holdingsSummaryOf(holdings, converter, now),
      netWorth: netWorthOf(accounts, converter, now),
      ratesAsOf: converter.ratesAsOf?.toISOString() ?? null,
    };
  }),

  renameAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.string().max(64),
        name: z.string().trim().max(MAX_ACCOUNT_NAME_LENGTH).nullable(),
      })
    )
    .handler(async ({ context, input }) => {
      const { count } = await prisma.bankAccount.updateMany({
        data: { customName: input.name || null },
        where: {
          connection: { userId: context.session.user.id },
          id: input.accountId,
        },
      });

      if (count === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Account not found" });
      }

      return { ok: true };
    }),
};
