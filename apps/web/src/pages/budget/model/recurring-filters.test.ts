import { describe, expect, it } from "bun:test";

import type { RecurringItem } from "./recurring";
import {
  EMPTY_RECURRING_FILTER,
  groupRecurringItems,
} from "./recurring-filters";
import type { RecurringFilter } from "./recurring-filters";

const item = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  amountSpread: 0,
  category: "subscriptions",
  confidence: "confirmed",
  currency: "EUR",
  frequency: "monthly",
  intervalDays: 30,
  kind: "fixed",
  lastSeen: "2026-08-05T00:00:00.000Z",
  merchantKey: "netflix",
  merchantName: "Netflix",
  nextExpected: "2026-09-04T00:00:00.000Z",
  occurrences: 6,
  typicalAmountMinor: 1000,
  ...overrides,
});

const filter = (overrides: Partial<RecurringFilter> = {}): RecurringFilter => ({
  ...EMPTY_RECURRING_FILTER,
  ...overrides,
});

const keys = (items: RecurringItem[]) =>
  items.map((entry) => entry.merchantKey);

describe("narrowing the recurring list", () => {
  it("reads a ticked group as every category in it", () => {
    const items = [
      item({ category: "savings", merchantKey: "savings-plan" }),
      item({ category: "subscriptions", merchantKey: "netflix" }),
    ];

    const groups = groupRecurringItems(
      items,
      filter({ categories: { categories: [], groups: ["investments"] } }),
      "cost"
    );

    expect(keys(groups.fixed.items)).toEqual(["savings-plan"]);
  });

  it("matches the bank's own key when it named no company", () => {
    const items = [
      item({ merchantKey: "sncf-voyages", merchantName: null }),
      item({ merchantKey: "netflix" }),
    ];

    const groups = groupRecurringItems(
      items,
      filter({ search: "sncf" }),
      "cost"
    );

    expect(keys(groups.fixed.items)).toEqual(["sncf-voyages"]);
  });

  it("bounds the monthly cost rather than the amount charged", () => {
    const yearlyInsuranceCostingAboutTwentyAMonth = item({
      intervalDays: 365,
      merchantKey: "insurance",
      typicalAmountMinor: 24_000,
    });

    const monthlyGymCostingOneFifty = item({
      merchantKey: "gym",
      typicalAmountMinor: 15_000,
    });

    const items = [
      yearlyInsuranceCostingAboutTwentyAMonth,
      monthlyGymCostingOneFifty,
    ];

    const groups = groupRecurringItems(
      items,
      filter({ amount: { max: 0, min: 100 } }),
      "cost"
    );

    expect(keys(groups.fixed.items)).toEqual(["gym"]);
  });

  it("keeps both kinds apart, and totals each on its own", () => {
    const items = [
      item({ merchantKey: "netflix", typicalAmountMinor: 1000 }),
      item({
        confidence: "pattern",
        kind: "behavioral",
        merchantKey: "bakery",
        typicalAmountMinor: 400,
      }),
    ];

    const groups = groupRecurringItems(items, EMPTY_RECURRING_FILTER, "cost");

    expect(keys(groups.fixed.items)).toEqual(["netflix"]);
    expect(keys(groups.behavioral.items)).toEqual(["bakery"]);
    expect(groups.fixed.monthlyMinor).toBe(1015);
    expect(groups.behavioral.monthlyMinor).toBe(406);
  });

  it("orders by the next date, then by what it costs a month", () => {
    const items = [
      item({ merchantKey: "later", nextExpected: "2026-09-20T00:00:00.000Z" }),
      item({ merchantKey: "sooner", nextExpected: "2026-09-10T00:00:00.000Z" }),
    ];

    const byNext = groupRecurringItems(items, EMPTY_RECURRING_FILTER, "next");
    const byCost = groupRecurringItems(
      [
        item({ merchantKey: "cheap", typicalAmountMinor: 100 }),
        item({ merchantKey: "dear", typicalAmountMinor: 9000 }),
      ],
      EMPTY_RECURRING_FILTER,
      "cost"
    );

    expect(keys(byNext.fixed.items)).toEqual(["sooner", "later"]);
    expect(keys(byCost.fixed.items)).toEqual(["dear", "cheap"]);
  });

  it("returns an empty side rather than dropping its tab", () => {
    const groups = groupRecurringItems(
      [item({ merchantKey: "netflix" })],
      filter({ frequencies: ["weekly"] }),
      "cost"
    );

    expect(groups.fixed.items).toEqual([]);
    expect(groups.behavioral.items).toEqual([]);
    expect(groups.fixed.monthlyMinor).toBe(0);
  });
});
