import { describe, expect, it } from "bun:test";

import { recentDateLabel } from "./recent-date";

const today = new Date(2026, 10, 18, 16, 30);

describe("recentDateLabel", () => {
  it("names today and yesterday", () => {
    expect(recentDateLabel(new Date(2026, 10, 18, 9), today, "en")).toBe(
      "Today"
    );

    expect(recentDateLabel(new Date(2026, 10, 17, 23), today, "en")).toBe(
      "Yesterday"
    );

    expect(recentDateLabel(new Date(2026, 10, 18, 9), today, "fr")).toBe(
      "Aujourd’hui"
    );
  });

  it("shows the day and month within the year, and the year before it", () => {
    expect(recentDateLabel(new Date(2026, 10, 4), today, "en")).toBe("Nov 4");
    expect(recentDateLabel(new Date(2025, 9, 28), today, "en")).toBe(
      "Oct 28, 2025"
    );
  });
});
