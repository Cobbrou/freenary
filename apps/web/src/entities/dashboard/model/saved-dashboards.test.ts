import { describe, expect, it } from "bun:test";

import type { UIMessage } from "ai";

import { savedDashboardsOf } from "./saved-dashboards";

const runningPart: UIMessage["parts"][number] = {
  input: {},
  state: "input-available",
  toolCallId: "call_1",
  type: "tool-save_dashboard",
};

const finishedPart = (
  output: Record<string, boolean | number | string>
): UIMessage["parts"][number] => ({
  input: {},
  output,
  state: "output-available",
  toolCallId: "call_1",
  type: "tool-save_dashboard",
});

describe("savedDashboardsOf", () => {
  it("reads the dashboard a finished save_dashboard call returned", () => {
    expect(
      savedDashboardsOf([
        { text: "Here it is.", type: "text" },
        finishedPart({
          created: true,
          dashboardId: "dash_1",
          title: "Lisbon trip",
        }),
      ])
    ).toEqual([{ created: true, dashboardId: "dash_1", title: "Lisbon trip" }]);
  });

  it("skips a call still running and an output of the wrong shape", () => {
    expect(
      savedDashboardsOf([runningPart, finishedPart({ dashboardId: 3 })])
    ).toEqual([]);
  });
});
