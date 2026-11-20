import { describe, expect, it } from "bun:test";

import {
  publishDashboardUpdate,
  subscribeToDashboardUpdates,
} from "./dashboard-updates";

describe("publishDashboardUpdate", () => {
  it("refreshes on its own when nothing on screen listens", () => {
    let refreshes = 0;

    publishDashboardUpdate({
      dashboardIds: ["dash_1"],
      refresh: () => {
        refreshes += 1;

        return Promise.resolve();
      },
    });

    expect(refreshes).toBe(1);
  });

  it("hands every listener one refresh that runs once", () => {
    let refreshes = 0;
    const seen: string[][] = [];
    const listen = (name: string) =>
      subscribeToDashboardUpdates((update) => {
        seen.push([name, ...update.dashboardIds]);
        void update.refresh();
      });

    const stopFirst = listen("sidebar");
    const stopSecond = listen("page");

    publishDashboardUpdate({
      dashboardIds: ["dash_1"],
      refresh: () => {
        refreshes += 1;

        return Promise.resolve();
      },
    });

    stopFirst();
    stopSecond();

    expect(seen).toEqual([
      ["sidebar", "dash_1"],
      ["page", "dash_1"],
    ]);

    expect(refreshes).toBe(1);
  });
});
