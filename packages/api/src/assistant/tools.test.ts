import { describe, expect, it } from "bun:test";

import { simulateReadableStream, stepCountIs, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { MAX_FILTER_AMOUNT_MINOR_UNITS } from "../lib/transaction-filters";
import type { AssistantToolApi, DashboardWriter } from "./tools";
import {
  assistantToolDefinitions,
  assistantTools,
  saveDashboard,
  searchFilters,
} from "./tools";

describe("searchFilters", () => {
  it("builds no filter when the assistant asks for none", () => {
    expect(searchFilters({}, "EUR")).toEqual([]);
  });

  it("merges categories and groups into one category filter", () => {
    expect(
      searchFilters({ categories: ["groceries"], groups: ["income"] }, "EUR")
    ).toEqual([
      {
        field: "category",
        operator: "isAnyOf",
        values: ["groceries", "income"],
      },
    ]);
  });

  it("keeps both bounds inclusive in minor units", () => {
    expect(searchFilters({ maxAmount: 80, minAmount: 50 }, "EUR")).toEqual([
      { field: "amount", operator: "gt", value: 4999 },
      { field: "amount", operator: "lt", value: 8001 },
    ]);
  });

  it("reads the minor-unit digits from the currency", () => {
    expect(searchFilters({ maxAmount: 80, minAmount: 50 }, "JPY")).toEqual([
      { field: "amount", operator: "gt", value: 49 },
      { field: "amount", operator: "lt", value: 81 },
    ]);
  });

  it("drops a zero floor, and caps a ceiling the schema would refuse", () => {
    expect(searchFilters({ maxAmount: 1e16, minAmount: 0 }, "EUR")).toEqual([
      { field: "amount", operator: "lt", value: MAX_FILTER_AMOUNT_MINOR_UNITS },
    ]);
  });
});

const widgets = [{ type: "budgets" as const }];

const recordingDashboards = () => {
  const calls: { input: unknown; procedure: string }[] = [];

  const dashboards: DashboardWriter = {
    create: (input) => {
      calls.push({ input, procedure: "create" });

      return Promise.resolve({ dashboardId: "dash_new", title: input.title });
    },
    update: (input) => {
      calls.push({ input, procedure: "update" });

      return Promise.resolve({
        dashboardId: input.dashboardId,
        title: input.title ?? "Unchanged",
      });
    },
  };

  return { calls, dashboards };
};

describe("saveDashboard", () => {
  it("creates a dashboard tied to the chat when no id is given", async () => {
    const { calls, dashboards } = recordingDashboards();

    expect(
      await saveDashboard(dashboards, "chat_1", {
        title: "Lisbon trip",
        widgets,
      })
    ).toEqual({ created: true, dashboardId: "dash_new", title: "Lisbon trip" });

    expect(calls).toEqual([
      {
        input: { conversationId: "chat_1", title: "Lisbon trip", widgets },
        procedure: "create",
      },
    ]);
  });

  it("replaces the dashboard it is given", async () => {
    const { calls, dashboards } = recordingDashboards();

    expect(
      await saveDashboard(dashboards, "chat_1", {
        dashboardId: "dash_1",
        title: "Monthly check-in",
        widgets,
      })
    ).toEqual({
      created: false,
      dashboardId: "dash_1",
      title: "Monthly check-in",
    });

    expect(calls[0]?.procedure).toBe("update");
  });

  it("keeps a dashboard's name when the change leaves it out", async () => {
    const { calls, dashboards } = recordingDashboards();

    await saveDashboard(dashboards, "chat_1", {
      dashboardId: "dash_1",
      widgets,
    });

    expect(calls).toEqual([
      {
        input: { dashboardId: "dash_1", title: undefined, widgets },
        procedure: "update",
      },
    ]);
  });

  it("refuses to create a dashboard with no name", async () => {
    const { calls, dashboards } = recordingDashboards();

    await expect(
      saveDashboard(dashboards, "chat_1", { widgets })
    ).rejects.toThrow("A new dashboard needs a title");

    expect(calls).toEqual([]);
  });
});

const firstTransactionDay = new Date("2026-08-25T00:00:00.000Z");

const lastTransactionDay = new Date("2026-11-22T00:00:00.000Z");

const budgetApi: AssistantToolApi["budget"] = {
  getAccounts: () =>
    Promise.resolve({
      accounts: [
        {
          iban: "FR7630006000011234567890189",
          id: "acc_1",
          institutionName: "Banque Lumière",
          name: "Compte de chèques",
        },
      ],
      currency: "EUR",
      firstTransactionDate: firstTransactionDay,
      hasAccounts: true,
      lastTransactionDate: lastTransactionDay,
    }),
  getBudgetVsActual: () =>
    Promise.resolve({
      categories: [{ actual: 12_345, category: "groceries", planned: 20_000 }],
      currency: "EUR",
      hasPlan: true,
      unconvertedCount: 0,
    }),
  getCashFlow: () =>
    Promise.resolve({
      currency: "EUR",
      periods: [{ incoming: 250_000, label: "Nov", outgoing: 180_000 }],
      unconvertedCount: 0,
    }),
  getFixedVsVariable: () =>
    Promise.resolve({
      currency: "EUR",
      fixed: 90_000,
      unconvertedCount: 0,
      variable: 45_000,
    }),
  getRecurringExpenses: () =>
    Promise.resolve({
      expenses: [
        {
          category: "subscriptions",
          currency: "EUR",
          frequency: "monthly",
          intervalDays: 30,
          lastSeen: "2026-11-05T00:00:00.000Z",
          merchantKey: "netflix",
          merchantName: "Netflix",
          nextExpected: "2026-12-05T00:00:00.000Z",
          occurrences: 12,
          reportingAmountMinor: 1399,
          typicalAmountMinor: 1399,
        },
      ],
    }),
  getSpendingBreakdown: () =>
    Promise.resolve({
      categories: [{ amount: 12_345, category: "groceries" }],
      currency: "EUR",
      unconvertedCount: 0,
    }),
  getTransactions: () =>
    Promise.resolve({
      currency: "EUR",
      nextCursor: null,
      totals: { incoming: 250_000, outgoing: 180_000, unconvertedCount: 0 },
      transactions: [
        {
          amount: -4250,
          category: "groceries",
          counterpartyName: null,
          currency: "EUR",
          date: "2026-11-20T00:00:00.000Z",
          derivedCategory: "groceries",
          description: "CARREFOUR MARKET PARIS",
          exchangeFeeMinor: null,
          id: "txn_1",
          isInternalTransfer: false,
          normalisedDescriptor: "carrefour market paris",
          originalAmount: null,
          originalCurrency: null,
        },
      ],
    }),
};

const toolApi: AssistantToolApi = {
  budget: budgetApi,
  dashboards: recordingDashboards().dashboards,
};

const jsonValue = z.json();

const period = { from: "2026-11-01", to: "2026-11-30" };

describe("assistant tool outputs", () => {
  const definitions = assistantToolDefinitions(toolApi);

  const outputs = {
    get_accounts_overview: () => definitions.get_accounts_overview.execute({}),
    get_budget_vs_actual: () =>
      definitions.get_budget_vs_actual.execute({
        aggregation: "total",
        ...period,
      }),
    get_cash_flow: () => definitions.get_cash_flow.execute(period),
    get_fixed_vs_variable: () =>
      definitions.get_fixed_vs_variable.execute({
        aggregation: "total",
        ...period,
      }),
    get_recurring_expenses: () =>
      definitions.get_recurring_expenses.execute({}),
    get_spending_by_group: () =>
      definitions.get_spending_by_group.execute({
        aggregation: "total",
        ...period,
      }),
    save_dashboard: () =>
      definitions.save_dashboard.execute({ title: "Monthly", widgets }),
    search_transactions: () =>
      definitions.search_transactions.execute({
        limit: 10,
        sort: "date",
        ...period,
      }),
  } satisfies Record<keyof typeof definitions, () => Promise<object>>;

  for (const [name, run] of Object.entries(outputs)) {
    it(`${name} returns plain JSON values`, async () => {
      expect(jsonValue.safeParse(await run()).success).toBe(true);
    });
  }

  it("gives the transaction date range as ISO strings", async () => {
    expect(await outputs.get_accounts_overview()).toEqual({
      accounts: [
        {
          id: "acc_1",
          institutionName: "Banque Lumière",
          name: "Compte de chèques",
        },
      ],
      currency: "EUR",
      firstTransactionDate: "2026-08-25T00:00:00.000Z",
      hasAccounts: true,
      lastTransactionDate: "2026-11-22T00:00:00.000Z",
    });
  });
});

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 10,
    total: 10,
  },
  outputTokens: { reasoning: undefined, text: 5, total: 5 },
};

type StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV4["doStream"]>
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never;

const streamOf = (chunks: StreamPart[]) => ({
  stream: simulateReadableStream({ chunks }),
});

describe("a turn that calls get_accounts_overview", () => {
  it("reaches the model's answer in the next step", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        streamOf([
          { type: "stream-start", warnings: [] },
          {
            input: "{}",
            toolCallId: "call_1",
            toolName: "get_accounts_overview",
            type: "tool-call",
          },
          {
            finishReason: { raw: "tool_calls", unified: "tool-calls" },
            type: "finish",
            usage,
          },
        ]),
        streamOf([
          { type: "stream-start", warnings: [] },
          { id: "text_1", type: "text-start" },
          { delta: "You have one account.", id: "text_1", type: "text-delta" },
          { id: "text_1", type: "text-end" },
          {
            finishReason: { raw: "stop", unified: "stop" },
            type: "finish",
            usage,
          },
        ]),
      ],
    });

    const errors: unknown[] = [];

    const turn = streamText({
      model,
      onError: ({ error }) => {
        errors.push(error);
      },
      prompt: "How much money is on my account?",
      stopWhen: stepCountIs(2),
      tools: assistantTools(toolApi),
    });

    expect(await turn.text).toBe("You have one account.");
    expect(errors).toEqual([]);
    expect(model.doStreamCalls).toHaveLength(2);
  });
});
