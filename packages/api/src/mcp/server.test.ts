import { describe, expect, it } from "bun:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

import type { AssistantToolApi } from "../assistant/tools";
import { createFreenaryMcpServer, MCP_TOOL_ANNOTATIONS } from "./server";

const ACCOUNTS = {
  accounts: [
    {
      iban: "FR7630006000011234567890189",
      id: "acc_1",
      institutionName: "Mock Bank",
      name: "Current account",
    },
  ],
  currency: "EUR",
  firstTransactionDate: new Date("2026-01-01T00:00:00.000Z"),
  hasAccounts: true,
  lastTransactionDate: new Date("2026-03-31T00:00:00.000Z"),
};

const notCalledHere = () =>
  Promise.reject(new Error("These tests never call this procedure"));

const savedDashboards: unknown[] = [];

const connectedClient = async () => {
  const api: AssistantToolApi = {
    budget: {
      getAccounts: () => Promise.resolve(ACCOUNTS),
      getBudgetVsActual: notCalledHere,
      getCashFlow: notCalledHere,
      getFixedVsVariable: notCalledHere,
      getRecurringExpenses: notCalledHere,
      getSpendingBreakdown: notCalledHere,
      getTransactions: notCalledHere,
    },
    dashboards: {
      create: (input) => {
        savedDashboards.push(input);

        return Promise.resolve({ dashboardId: "dash_1", title: input.title });
      },
      update: notCalledHere,
    },
  };

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await createFreenaryMcpServer(api, "9.9.9").connect(serverSide);
  await client.connect(clientSide);

  return client;
};

describe("createFreenaryMcpServer", () => {
  it("serves every assistant tool, with read-only hints on the reads", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).toSorted()).toEqual(
      Object.keys(MCP_TOOL_ANNOTATIONS).toSorted()
    );

    const writes = tools.filter(
      (tool) => tool.annotations?.readOnlyHint !== true
    );

    expect(writes.map((tool) => tool.name)).toEqual(["save_dashboard"]);
    expect(client.getServerVersion()).toMatchObject({
      name: "freenary",
      version: "9.9.9",
    });

    expect(client.getInstructions()).toContain("get_accounts_overview");
  });

  it("answers a tool call with the tool's result as JSON text", async () => {
    const client = await connectedClient();
    const overview = await client.callTool({
      arguments: {},
      name: "get_accounts_overview",
    });

    const [item] = z
      .array(z.object({ text: z.string(), type: z.literal("text") }))
      .parse(overview.content);

    expect(JSON.parse(item?.text ?? "null")).toEqual({
      accounts: [
        { id: "acc_1", institutionName: "Mock Bank", name: "Current account" },
      ],
      currency: "EUR",
      firstTransactionDate: "2026-01-01T00:00:00.000Z",
      hasAccounts: true,
      lastTransactionDate: "2026-03-31T00:00:00.000Z",
    });
  });

  it("creates a dashboard through save_dashboard", async () => {
    const client = await connectedClient();
    const saved = await client.callTool({
      arguments: { title: "Spending", widgets: [{ type: "budgets" }] },
      name: "save_dashboard",
    });

    expect(saved.isError).toBeUndefined();
    expect(savedDashboards).toEqual([
      {
        conversationId: undefined,
        title: "Spending",
        widgets: [{ type: "budgets" }],
      },
    ]);
  });

  it("reports invalid arguments as a tool error instead of calling the API", async () => {
    const client = await connectedClient();
    const refused = await client.callTool({
      arguments: { from: "not a day" },
      name: "get_cash_flow",
    });

    expect(refused.isError).toBe(true);
  });
});
