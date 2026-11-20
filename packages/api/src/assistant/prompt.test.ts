import { describe, expect, it } from "bun:test";

import { assistantSystemPrompt, localDay } from "./prompt";
import { DAY } from "./tools";

describe("localDay", () => {
  it("reads the calendar day in the local time zone", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("DAY", () => {
  it("refuses a day that does not exist", () => {
    expect(DAY.safeParse("2026-13-45").success).toBe(false);
    expect(DAY.safeParse("2026-02-29").success).toBe(false);
  });

  it("accepts a real day", () => {
    expect(DAY.safeParse("2028-02-29").success).toBe(true);
  });
});

describe("assistantSystemPrompt", () => {
  const accounts = {
    firstTransactionDate: "2026-01-01",
    hasAccounts: true,
    lastTransactionDate: "2026-11-17",
  };

  it("lists the user's dashboards by id", () => {
    const prompt = assistantSystemPrompt(accounts, "en", "2026-11-18", {
      saved: [{ id: "dash_1", title: "Lisbon trip" }],
    });

    expect(prompt).toContain("- dash_1: Lisbon trip");
    expect(prompt).not.toContain("The user is looking at");
  });

  it("names the dashboard on screen with its widgets", () => {
    const prompt = assistantSystemPrompt(accounts, "en", "2026-11-18", {
      focused: {
        id: "dash_1",
        title: "Monthly check-in",
        widgets: [{ type: "budgets" }],
      },
      saved: [],
    });

    expect(prompt).toContain(
      'The user is looking at the dashboard "Monthly check-in" (dashboardId dash_1).'
    );

    expect(prompt).toContain('[{"type":"budgets"}]');
  });
});
