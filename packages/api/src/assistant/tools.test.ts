import { describe, expect, it } from "bun:test";

import { MAX_FILTER_AMOUNT_MINOR_UNITS } from "../lib/transaction-filters";
import type { DashboardWriter } from "./tools";
import { saveDashboard, searchFilters } from "./tools";

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
