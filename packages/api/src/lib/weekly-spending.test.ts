import { describe, expect, it } from "bun:test";

import {
  spendingWeeksStart,
  weeklySpending,
  weekStartOf,
} from "./weekly-spending";

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("weekStartOf", () => {
  it("goes back to the Monday of the week", () => {
    expect(weekStartOf(day("2026-11-18")).toISOString()).toBe(
      "2026-11-16T00:00:00.000Z"
    );
  });

  it("counts a Sunday in the week that began six days before", () => {
    expect(weekStartOf(day("2026-11-22")).toISOString()).toBe(
      "2026-11-16T00:00:00.000Z"
    );
  });
});

describe("spendingWeeksStart", () => {
  it("starts the window on the Monday weeks-1 weeks before this one", () => {
    expect(spendingWeeksStart(day("2026-11-18"), 3).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z"
    );
  });
});

describe("weeklySpending", () => {
  it("sums each week's spending per category, largest first", () => {
    const weeks = weeklySpending(
      [
        { amount: -1200, category: "groceries", date: day("2026-11-03") },
        { amount: -800, category: "restaurants", date: day("2026-11-04") },
        { amount: -2500, category: "restaurants", date: day("2026-11-17") },
      ],
      day("2026-11-18"),
      3
    );

    expect(weeks).toEqual([
      {
        categories: [
          { amountMinor: 1200, category: "groceries" },
          { amountMinor: 800, category: "restaurants" },
        ],
        start: "2026-11-02",
        totalMinor: 2000,
      },
      { categories: [], start: "2026-11-09", totalMinor: 0 },
      {
        categories: [{ amountMinor: 2500, category: "restaurants" }],
        start: "2026-11-16",
        totalMinor: 2500,
      },
    ]);
  });

  it("leaves out money coming in, savings and rows outside the window", () => {
    const weeks = weeklySpending(
      [
        { amount: 300_000, category: "salary", date: day("2026-11-17") },
        { amount: -50_000, category: "savings", date: day("2026-11-17") },
        { amount: -900, category: "groceries", date: day("2026-10-01") },
      ],
      day("2026-11-18"),
      1
    );

    expect(weeks).toEqual([
      { categories: [], start: "2026-11-16", totalMinor: 0 },
    ]);
  });
});
