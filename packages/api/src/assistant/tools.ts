import type { Tool } from "ai";
import { tool } from "ai";
import { z } from "zod";

import { AGGREGATION_MODES } from "../lib/aggregation";
import { CATEGORY_GROUPS, SPENDING_CATEGORIES } from "../lib/taxonomy";
import type { AppRouterClient } from "../routers/index";

export const DAY = z.iso.date();

const period = {
  from: DAY.describe("inclusive first day, YYYY-MM-DD"),
  to: DAY.describe("inclusive last day, YYYY-MM-DD"),
};

const aggregation = z
  .enum(AGGREGATION_MODES)
  .default("total")
  .describe("total over the period, or the per-month average or median");

const inclusiveDayRange = (from: string, to: string) => ({
  from: new Date(`${from}T00:00:00.000Z`),
  to: new Date(`${to}T23:59:59.999Z`),
});

const decimalAmount = (minorUnits: number): string =>
  (minorUnits / 100).toFixed(2);

export type AssistantToolName = keyof typeof ASSISTANT_TOOL_NAMES;

const ASSISTANT_TOOL_NAMES = {
  get_accounts_overview: true,
  get_budget_vs_actual: true,
  get_cash_flow: true,
  get_fixed_vs_variable: true,
  get_recurring_expenses: true,
  get_spending_by_group: true,
  search_transactions: true,
} as const;

const MAX_TRANSACTION_ROWS = 20;

const DEFAULT_TRANSACTION_ROWS = 10;

export const assistantTools = (api: AppRouterClient) =>
  ({
    get_accounts_overview: tool({
      description:
        "List the user's bank accounts and the date range transaction data covers. Call this first when you do not know whether any account is connected.",
      execute: async () => {
        const { accounts, ...range } = await api.budget.getAccounts();

        return {
          ...range,
          accounts: accounts.map(({ id, institutionName, name }) => ({
            id,
            institutionName,
            name,
          })),
        };
      },
      inputSchema: z.object({}),
    }),

    get_budget_vs_actual: tool({
      description:
        "Compare the user's declared monthly budget with what they actually spent, per category.",
      execute: async ({ aggregation: mode, from, to }) => {
        const { categories, hasPlan } = await api.budget.getBudgetVsActual({
          aggregation: mode,
          ...inclusiveDayRange(from, to),
        });

        return {
          categories: categories.map(({ actual, category, planned }) => ({
            actual: decimalAmount(actual),
            category,
            planned: decimalAmount(planned),
          })),
          currency: "EUR",
          hasPlan,
        };
      },
      inputSchema: z.object({ aggregation, ...period }),
    }),

    get_cash_flow: tool({
      description:
        "Incoming and outgoing totals over time for a period, bucketed by day, week or month depending on its length.",
      execute: async ({ from, to }) => {
        const { periods } = await api.budget.getCashFlow(
          inclusiveDayRange(from, to)
        );

        return {
          currency: "EUR",
          periods: periods.map(({ incoming, label, outgoing }) => ({
            incoming: decimalAmount(incoming),
            label,
            outgoing: decimalAmount(outgoing),
          })),
        };
      },
      inputSchema: z.object(period),
    }),

    get_fixed_vs_variable: tool({
      description:
        "Split outgoings into the part that recurs (rent, subscriptions, insurance) and the part that does not.",
      execute: async ({ aggregation: mode, from, to }) => {
        const { fixed, variable } = await api.budget.getFixedVsVariable({
          aggregation: mode,
          ...inclusiveDayRange(from, to),
        });

        return {
          currency: "EUR",
          fixed: decimalAmount(fixed),
          variable: decimalAmount(variable),
        };
      },
      inputSchema: z.object({ aggregation, ...period }),
    }),

    get_recurring_expenses: tool({
      description:
        "Recurring payments detected over the trailing year, with their cadence, typical amount and next expected date.",
      execute: async () => {
        const { expenses } = await api.budget.getRecurringExpenses();

        return {
          expenses: expenses.map(({ typicalAmountMinor, ...rest }) => ({
            ...rest,
            typicalAmount: decimalAmount(typicalAmountMinor),
          })),
        };
      },
      inputSchema: z.object({}),
    }),

    get_spending_by_group: tool({
      description:
        "Outgoing totals per category for a period. The cheapest way to answer 'where did my money go'.",
      execute: async ({ aggregation: mode, from, to }) => {
        const { categories } = await api.budget.getSpendingBreakdown({
          aggregation: mode,
          ...inclusiveDayRange(from, to),
        });

        return {
          categories: categories.map(({ amount, category }) => ({
            category,
            total: decimalAmount(amount),
          })),
          currency: "EUR",
        };
      },
      inputSchema: z.object({ aggregation, ...period }),
    }),

    search_transactions: tool({
      description:
        "Individual transactions in a period, optionally filtered by free text, category, category group, direction or how much money moved. Returns ids so an answer can point at the rows behind it.",
      execute: async ({
        categories,
        direction,
        from,
        groups,
        limit,
        maxAmount,
        minAmount,
        search,
        sort,
        to,
      }) => {
        const { totals, transactions } = await api.budget.getTransactions({
          amountMax:
            maxAmount === undefined ? undefined : Math.round(maxAmount * 100),
          amountMin:
            minAmount === undefined ? undefined : Math.round(minAmount * 100),
          categories,
          direction,
          groups,
          limit,
          search,
          sort,
          ...inclusiveDayRange(from, to),
        });

        if (totals === null) {
          throw new Error(
            "A first page of transactions came back without totals"
          );
        }

        return {
          totals: {
            currency: "EUR",
            incoming: decimalAmount(totals.incoming),
            outgoing: decimalAmount(totals.outgoing),
          },
          transactions: transactions.map(({ amount, ...rest }) => ({
            ...rest,
            amount: decimalAmount(amount),
          })),
        };
      },
      inputSchema: z.object({
        categories: z.array(z.enum(SPENDING_CATEGORIES)).optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        groups: z.array(z.enum(CATEGORY_GROUPS)).optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_TRANSACTION_ROWS)
          .default(DEFAULT_TRANSACTION_ROWS),
        maxAmount: z
          .number()
          .min(0)
          .optional()
          .describe("largest amount to return, in units of currency"),
        minAmount: z
          .number()
          .min(0)
          .optional()
          .describe(
            "smallest amount to return, in units of currency; both bounds ignore the sign"
          ),
        search: z.string().optional(),
        sort: z.enum(["date", "amount"]).default("date"),
        ...period,
      }),
    }),
  }) satisfies Record<AssistantToolName, Tool>;

export const isAssistantToolName = (
  value: string
): value is AssistantToolName => Object.hasOwn(ASSISTANT_TOOL_NAMES, value);
