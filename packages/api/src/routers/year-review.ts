import prisma from "@freenary/db";
import { z } from "zod";

import {
  cadenceWindow,
  detectRecurringExpenses,
} from "../categorisation/recurrence";
import { protectedProcedure } from "../index";
import { cashFlowAccountsOf, countedAccountsOf } from "../lib/account-types";
import {
  balanceHistory,
  monthEndsBefore,
  unconvertedHistoryCurrencies,
} from "../lib/balance-history";
import { outgoingByCategory, periodRows } from "../lib/budget-aggregates";
import { isCalendarBudgetMonth } from "../lib/budget-month";
import { countedInFiguresWhere } from "../lib/counted-transactions";
import { userBudgetMonthRule } from "../lib/user-budget-month";
import { userConverter } from "../lib/user-currency";
import {
  categoriesOf,
  largestExpenseOf,
  monthlyOf,
  monthsBackToYearStart,
  pointsWithinYear,
  recurringYearOf,
  reviewYearOf,
  reviewYearRange,
  reviewYears,
  topMerchantsOf,
  yearFiguresOf,
} from "../lib/year-review";

const EARLIEST_YEAR = 1970;

const LATEST_YEAR = 9999;

export const yearReviewProcedures = {
  getYearInReview: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(EARLIEST_YEAR).max(LATEST_YEAR).optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const now = new Date();
      const featuredYear = reviewYearOf(now);

      if (featuredYear === null) {
        return { featuredYear, review: null, years: [] };
      }

      const [first, rule] = await Promise.all([
        prisma.transaction.aggregate({
          _min: { date: true },
          where: {
            AND: [countedInFiguresWhere],
            account: cashFlowAccountsOf(userId),
          },
        }),
        userBudgetMonthRule(userId),
      ]);

      const years = reviewYears(first._min.date, featuredYear);
      const year = input.year ?? featuredYear;

      if (!years.includes(year)) {
        return { featuredYear, review: null, years };
      }

      const current = reviewYearRange(year, rule);
      const previous = reviewYearRange(year - 1, rule);
      const [firstMonthEnd = previous.to] = monthEndsBefore(
        now,
        monthsBackToYearStart(year, now)
      );

      const converter = await userConverter(userId, previous.from, now);
      const [counted, previousCounted, recurring, accounts, balanceRows] =
        await Promise.all([
          periodRows(userId, current.from, current.to, converter),
          periodRows(userId, previous.from, previous.to, converter),
          detectRecurringExpenses(
            userId,
            cadenceWindow(current.from, current.to),
            converter
          ),
          prisma.bankAccount.findMany({
            select: {
              balanceMinor: true,
              balances: {
                select: { balanceAt: true, balanceMinor: true, currency: true },
              },
              currency: true,
              id: true,
              type: true,
            },
            where: countedAccountsOf(userId),
          }),
          prisma.transaction.findMany({
            select: {
              accountId: true,
              amount: true,
              currency: true,
              date: true,
            },
            where: {
              account: countedAccountsOf(userId),
              date: { gt: firstMonthEnd },
            },
          }),
        ]);

      const { rows } = counted;
      const previousRows = previousCounted.rows;
      const byCategory = (outgoing: typeof rows, range: typeof current) =>
        outgoingByCategory(
          outgoing.filter((row) => row.amount < 0),
          { aggregation: "total", from: range.from, rule, to: range.to }
        );

      return {
        featuredYear,
        review: {
          basis: isCalendarBudgetMonth(rule)
            ? ("calendar" as const)
            : ("budget-months" as const),
          categories: categoriesOf(
            byCategory(rows, current),
            byCategory(previousRows, previous)
          ),
          currency: converter.currency,
          current: yearFiguresOf(rows, rule),
          from: current.from.toISOString(),
          largestExpense: largestExpenseOf(rows),
          merchants: topMerchantsOf(rows),
          months: monthlyOf(rows, current, rule),
          netWorth: {
            points: pointsWithinYear(
              balanceHistory(
                accounts,
                balanceRows,
                converter,
                now,
                monthsBackToYearStart(year, now)
              ),
              year
            ),
            unconvertedCurrencies: unconvertedHistoryCurrencies(
              accounts,
              converter,
              now
            ),
          },
          previous:
            previousRows.length > 0 ? yearFiguresOf(previousRows, rule) : null,
          recurring: recurringYearOf(
            rows,
            new Set(
              recurring.flatMap((expense) =>
                expense.kind === "fixed" ? [expense.merchantKey] : []
              )
            )
          ),
          to: current.to.toISOString(),
          unconvertedCount:
            counted.unconvertedCount + previousCounted.unconvertedCount,
          year,
        },
        years,
      };
    }),
};
