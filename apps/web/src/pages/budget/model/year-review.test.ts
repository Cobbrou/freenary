import { describe, expect, it } from "bun:test";

import {
  changeOf,
  comparisonOf,
  netWorthChangeOf,
  priciestMonthOf,
  STORY_SLIDE_MS,
  STORY_START,
  STORY_TICK_MS,
  storyReducer,
  storySlides,
} from "./year-review";
import type { YearFigures, YearReview } from "./year-review";

const figures = (overrides: Partial<YearFigures> = {}): YearFigures => ({
  expensesMinor: 200_000,
  incomeMinor: 300_000,
  monthsWithData: 12,
  netMinor: 100_000,
  paymentCount: 40,
  savedMinor: 20_000,
  savingsRate: 0.4,
  ...overrides,
});

const merchant = (merchantKey: string, count: number, totalMinor: number) => ({
  count,
  merchantKey,
  merchantName: null,
  totalMinor,
});

const review = (overrides: Partial<YearReview> = {}): YearReview => ({
  basis: "calendar",
  categories: [
    { amountMinor: 80_000, category: "groceries", previousAmountMinor: 0 },
  ],
  currency: "EUR",
  current: figures(),
  from: "2026-01-01T00:00:00.000Z",
  largestExpense: null,
  merchants: {
    byAmount: [merchant("airline", 1, 90_000)],
    byCount: [merchant("cafe", 30, 9000)],
  },
  months: [
    { incomingMinor: 0, month: "2026-01", outgoingMinor: 10_000 },
    { incomingMinor: 0, month: "2026-02", outgoingMinor: 30_000 },
  ],
  netWorth: { points: [], unconvertedCurrencies: [] },
  previous: figures({ expensesMinor: 160_000 }),
  recurring: { items: [], merchantCount: 0, totalMinor: 0 },
  to: "2026-12-31T23:59:59.999Z",
  unconvertedCount: 0,
  year: 2026,
  ...overrides,
});

describe("changeOf", () => {
  it("gives the change from the year before, none from nothing", () => {
    expect(changeOf(150, 100)).toBe(0.5);
    expect(changeOf(150, 0)).toBeNull();
  });
});

describe("comparisonOf", () => {
  it("compares only two full years without a note", () => {
    expect(comparisonOf(review())).toBe("full");
    expect(comparisonOf(review({ previous: null }))).toBe("none");
    expect(
      comparisonOf(review({ current: figures({ monthsWithData: 11 }) }))
    ).toBe("partial");
  });
});

describe("priciestMonthOf", () => {
  it("finds the month with the most spending", () => {
    expect(priciestMonthOf(review().months)?.month).toBe("2026-02");
    expect(priciestMonthOf([])).toBeNull();
  });
});

describe("netWorthChangeOf", () => {
  it("needs a start and an end", () => {
    expect(
      netWorthChangeOf([
        { balanceMinor: 1000, date: "2025-12-31" },
        { balanceMinor: 1500, date: "2026-12-31" },
      ])
    ).toEqual({ changeMinor: 500, endMinor: 1500, startMinor: 1000 });

    expect(
      netWorthChangeOf([{ balanceMinor: 1000, date: "2025-12-31" }])
    ).toBeNull();
  });
});

describe("storySlides", () => {
  it("tells the year from spending to savings, skipping what is missing", () => {
    expect(storySlides(review()).map((slide) => slide.kind)).toEqual([
      "intro",
      "spent",
      "category",
      "merchant",
      "regular",
      "month",
      "saved",
      "outro",
    ]);
  });

  it("leaves the change out when a year is partial", () => {
    const spent = storySlides(
      review({ current: figures({ monthsWithData: 11 }) })
    ).find((slide) => slide.kind === "spent");

    expect(spent).toEqual({
      change: null,
      expensesMinor: 200_000,
      kind: "spent",
    });
  });

  it("does not repeat a merchant first by amount and by payments", () => {
    const kinds = storySlides(
      review({
        merchants: {
          byAmount: [merchant("cafe", 30, 9000)],
          byCount: [merchant("cafe", 30, 9000)],
        },
      })
    ).map((slide) => slide.kind);

    expect(kinds).toContain("merchant");
    expect(kinds).not.toContain("regular");
  });
});

describe("storyReducer", () => {
  it("moves to the next slide once a slide has played", () => {
    let state = STORY_START;

    for (let tick = 0; tick < STORY_SLIDE_MS / STORY_TICK_MS; tick += 1) {
      state = storyReducer(state, { kind: "tick", last: 2 });
    }

    expect(state).toEqual({ elapsedMs: 0, index: 1 });
  });

  it("stays on the last slide and within the slides", () => {
    const last = { elapsedMs: 0, index: 2 };

    expect(storyReducer(last, { kind: "tick", last: 2 })).toBe(last);
    expect(storyReducer(last, { kind: "go", last: 2, step: 1 })).toEqual(last);
    expect(
      storyReducer(STORY_START, { kind: "go", last: 2, step: -1 })
    ).toEqual(STORY_START);

    expect(storyReducer(last, { kind: "restart" })).toEqual(STORY_START);
  });
});
