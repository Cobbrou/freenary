import type { Tool } from "ai";
import { tool } from "ai";
import { z } from "zod";

import {
  dashboardTitleSchema,
  dashboardWidgetsSchema,
} from "../dashboards/widgets";
import type { DashboardWidget } from "../dashboards/widgets";
import { AGGREGATION_MODES } from "../lib/aggregation";
import { fromMinor, minorUnitDigits, toMinor } from "../lib/money";
import { CATEGORY_GROUPS, SPENDING_CATEGORIES } from "../lib/taxonomy";
import { MAX_FILTER_AMOUNT_MINOR_UNITS } from "../lib/transaction-filters";
import type {
  CategoryFilterValue,
  TransactionFilter,
} from "../lib/transaction-filters";
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

const isoTimestamp = (date: Date | string | null): string | null =>
  date === null ? null : new Date(date).toISOString();

const decimalAmount = (minorUnits: number, currency: string): string =>
  fromMinor(minorUnits, currency).toFixed(minorUnitDigits(currency));

interface SearchFilterInput {
  readonly categories?: readonly CategoryFilterValue[];
  readonly groups?: readonly CategoryFilterValue[];
  readonly maxAmount?: number;
  readonly minAmount?: number;
}

export const searchFilters = (
  { categories = [], groups = [], maxAmount, minAmount }: SearchFilterInput,
  currency: string
): TransactionFilter[] => {
  const filters: TransactionFilter[] = [];
  const minorUnits = (amount: number) => toMinor(amount, currency);
  const values = [...categories, ...groups];

  if (values.length > 0) {
    filters.push({ field: "category", operator: "isAnyOf", values });
  }

  if (minAmount !== undefined && minorUnits(minAmount) > 0) {
    filters.push({
      field: "amount",
      operator: "gt",
      value: minorUnits(minAmount) - 1,
    });
  }

  if (maxAmount !== undefined) {
    filters.push({
      field: "amount",
      operator: "lt",
      value: Math.min(minorUnits(maxAmount) + 1, MAX_FILTER_AMOUNT_MINOR_UNITS),
    });
  }

  return filters;
};

export type AssistantToolName = keyof typeof ASSISTANT_TOOL_NAMES;

const ASSISTANT_TOOL_NAMES = {
  get_accounts_overview: true,
  get_budget_vs_actual: true,
  get_cash_flow: true,
  get_fixed_vs_variable: true,
  get_recurring_expenses: true,
  get_spending_by_group: true,
  save_dashboard: true,
  search_transactions: true,
} as const;

export interface AssistantToolContext {
  readonly conversationId?: string;
}

export interface AssistantToolDefinition<
  Input extends z.ZodObject = z.ZodObject,
  Output = unknown,
> {
  readonly description: string;
  readonly inputSchema: Input;
  readonly execute: (input: z.output<Input>) => Promise<Output>;
}

const defineTool = <Input extends z.ZodObject, Output>(
  definition: AssistantToolDefinition<Input, Output>
) => definition;

export interface SaveDashboardInput {
  dashboardId?: string;
  title?: string;
  widgets: DashboardWidget[];
}

interface SavedDashboard {
  dashboardId: string;
  title: string;
}

export interface DashboardWriter {
  create: (input: {
    conversationId?: string;
    title: string;
    widgets: DashboardWidget[];
  }) => Promise<SavedDashboard>;
  update: (input: {
    dashboardId: string;
    title?: string;
    widgets: DashboardWidget[];
  }) => Promise<SavedDashboard>;
}

export const saveDashboard = async (
  dashboards: DashboardWriter,
  conversationId: string | undefined,
  { dashboardId, title, widgets }: SaveDashboardInput
) => {
  if (dashboardId !== undefined) {
    const saved = await dashboards.update({ dashboardId, title, widgets });

    return { ...saved, created: false };
  }

  if (title === undefined) {
    throw new Error("A new dashboard needs a title");
  }

  const saved = await dashboards.create({ conversationId, title, widgets });

  return { ...saved, created: true };
};

const MAX_TRANSACTION_ROWS = 20;

const DEFAULT_TRANSACTION_ROWS = 10;

export interface AssistantToolApi {
  readonly budget: Pick<
    AppRouterClient["budget"],
    | "getAccounts"
    | "getBudgetVsActual"
    | "getCashFlow"
    | "getFixedVsVariable"
    | "getRecurringExpenses"
    | "getSpendingBreakdown"
    | "getTransactions"
  >;
  readonly dashboards: DashboardWriter;
}

export const assistantToolDefinitions = (
  api: AssistantToolApi,
  { conversationId }: AssistantToolContext = {}
) => ({
  get_accounts_overview: defineTool({
    description:
      "List the user's bank accounts and the date range transaction data covers. Call this first when you do not know whether any account is connected.",
    execute: async () => {
      const {
        accounts,
        currency,
        firstTransactionDate,
        hasAccounts,
        lastTransactionDate,
      } = await api.budget.getAccounts();

      return {
        accounts: accounts.map(({ id, institutionName, name }) => ({
          id,
          institutionName,
          name,
        })),
        currency,
        firstTransactionDate: isoTimestamp(firstTransactionDate),
        hasAccounts,
        lastTransactionDate: isoTimestamp(lastTransactionDate),
      };
    },
    inputSchema: z.object({}),
  }),

  get_budget_vs_actual: defineTool({
    description:
      "Compare the user's declared monthly budget with what they actually spent, per category.",
    execute: async ({ aggregation: mode, from, to }) => {
      const { categories, currency, hasPlan } =
        await api.budget.getBudgetVsActual({
          aggregation: mode,
          ...inclusiveDayRange(from, to),
        });

      return {
        categories: categories.map(({ actual, category, planned }) => ({
          actual: decimalAmount(actual, currency),
          category,
          planned: decimalAmount(planned, currency),
        })),
        currency,
        hasPlan,
      };
    },
    inputSchema: z.object({ aggregation, ...period }),
  }),

  get_cash_flow: defineTool({
    description:
      "Incoming and outgoing totals over time for a period, bucketed by day, week or month depending on its length.",
    execute: async ({ from, to }) => {
      const { currency, periods } = await api.budget.getCashFlow(
        inclusiveDayRange(from, to)
      );

      return {
        currency,
        periods: periods.map(({ incoming, label, outgoing }) => ({
          incoming: decimalAmount(incoming, currency),
          label,
          outgoing: decimalAmount(outgoing, currency),
        })),
      };
    },
    inputSchema: z.object(period),
  }),

  get_fixed_vs_variable: defineTool({
    description:
      "Split outgoings into the part that recurs (rent, subscriptions, insurance) and the part that does not.",
    execute: async ({ aggregation: mode, from, to }) => {
      const { currency, fixed, variable } = await api.budget.getFixedVsVariable(
        {
          aggregation: mode,
          ...inclusiveDayRange(from, to),
        }
      );

      return {
        currency,
        fixed: decimalAmount(fixed, currency),
        variable: decimalAmount(variable, currency),
      };
    },
    inputSchema: z.object({ aggregation, ...period }),
  }),

  get_recurring_expenses: defineTool({
    description:
      "Recurring payments detected over the trailing year, with their cadence, typical amount and next expected date.",
    execute: async () => {
      const { expenses } = await api.budget.getRecurringExpenses();

      return {
        expenses: expenses.map(({ typicalAmountMinor, ...rest }) => ({
          ...rest,
          typicalAmount: decimalAmount(typicalAmountMinor, rest.currency),
        })),
      };
    },
    inputSchema: z.object({}),
  }),

  get_spending_by_group: defineTool({
    description:
      "Outgoing totals per category for a period. The cheapest way to answer 'where did my money go'.",
    execute: async ({ aggregation: mode, from, to }) => {
      const { categories, currency } = await api.budget.getSpendingBreakdown({
        aggregation: mode,
        ...inclusiveDayRange(from, to),
      });

      return {
        categories: categories.map(({ amount, category }) => ({
          category,
          total: decimalAmount(amount, currency),
        })),
        currency,
      };
    },
    inputSchema: z.object({ aggregation, ...period }),
  }),

  save_dashboard: defineTool({
    description:
      "Create a dashboard, or replace one's title and widgets when you pass its dashboardId. Widgets read the user's live data themselves, so never pass figures. Returns the dashboard's id.",
    execute: (input) => saveDashboard(api.dashboards, conversationId, input),
    inputSchema: z.object({
      dashboardId: z
        .string()
        .optional()
        .describe("the dashboard to change; leave it out to create one"),
      title: dashboardTitleSchema
        .optional()
        .describe(
          "the dashboard's name; needed to create one, left out to keep a dashboard's current name"
        ),
      widgets: dashboardWidgetsSchema.describe(
        "every widget the dashboard shows, in order; stats sit three to a row"
      ),
    }),
  }),

  search_transactions: defineTool({
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
      const { currency: boundsCurrency } = await api.budget.getAccounts();
      const filters = searchFilters(
        { categories, groups, maxAmount, minAmount },
        boundsCurrency
      );

      const { currency, totals, transactions } =
        await api.budget.getTransactions({
          direction,
          filters: filters.length > 0 ? filters : undefined,
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
          currency,
          incoming: decimalAmount(totals.incoming, currency),
          outgoing: decimalAmount(totals.outgoing, currency),
        },
        transactions: transactions.map(({ amount, ...rest }) => ({
          ...rest,
          amount: decimalAmount(amount, rest.currency),
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
});

export const assistantTools = (
  api: AssistantToolApi,
  context: AssistantToolContext = {}
) => {
  const definitions = assistantToolDefinitions(api, context);

  return {
    get_accounts_overview: tool(definitions.get_accounts_overview),
    get_budget_vs_actual: tool(definitions.get_budget_vs_actual),
    get_cash_flow: tool(definitions.get_cash_flow),
    get_fixed_vs_variable: tool(definitions.get_fixed_vs_variable),
    get_recurring_expenses: tool(definitions.get_recurring_expenses),
    get_spending_by_group: tool(definitions.get_spending_by_group),
    save_dashboard: tool(definitions.save_dashboard),
    search_transactions: tool(definitions.search_transactions),
  } satisfies Record<AssistantToolName, Tool>;
};

export const isAssistantToolName = (
  value: string
): value is AssistantToolName => Object.hasOwn(ASSISTANT_TOOL_NAMES, value);
