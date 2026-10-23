import { describe, expect, it } from "bun:test";

import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import {
  breakdownSlices,
  isSliceSelected,
  sliceCategories,
} from "./spending-breakdown";
import type { CategoryAmount } from "./spending-breakdown";

const SPENDING: SpendingCategory[] = [
  "groceries",
  "restaurants",
  "rent-mortgage",
  "bills-utilities",
  "car-fuel",
  "transport-travel",
  "shopping",
  "entertainment",
  "subscriptions",
  "health",
];

const spendingIn = (count: number): CategoryAmount[] =>
  SPENDING.slice(0, count).map((category, place) => ({
    amount: (place + 1) * 1000,
    category,
  }));

const shownCategories = (count: number) =>
  breakdownSlices(spendingIn(count)).map((slice) =>
    slice.kind === "other" ? "other" : slice.category
  );

describe("breakdownSlices", () => {
  it("shows every category when there are five", () => {
    expect(shownCategories(5)).toEqual([
      "car-fuel",
      "bills-utilities",
      "rent-mortgage",
      "restaurants",
      "groceries",
    ]);
  });

  it("shows every category when there are seven", () => {
    expect(shownCategories(7)).toHaveLength(7);
    expect(shownCategories(7)).not.toContain("other");
  });

  it("groups all but the six largest of eight into an other of two", () => {
    const slices = breakdownSlices(spendingIn(8));
    const other = slices.at(-1);

    expect(slices).toHaveLength(7);
    expect(other?.kind === "other" && other.categories).toEqual([
      { amount: 2000, category: "restaurants" },
      { amount: 1000, category: "groceries" },
    ]);
  });

  it("sums the four smallest of ten into the last slice", () => {
    const slices = breakdownSlices(spendingIn(10));

    expect(slices.slice(0, 6).map((slice) => slice.kind)).toEqual(
      Array.from({ length: 6 }, () => "category")
    );

    expect(slices.at(-1)).toEqual({
      amount: 4000 + 3000 + 2000 + 1000,
      categories: [
        { amount: 4000, category: "bills-utilities" },
        { amount: 3000, category: "rent-mortgage" },
        { amount: 2000, category: "restaurants" },
        { amount: 1000, category: "groceries" },
      ],
      kind: "other",
    });
  });

  it("keeps other last even when it outweighs every category it follows", () => {
    const slices = breakdownSlices([
      ...spendingIn(6).map((entry) => ({ ...entry, amount: 100 })),
      { amount: 90, category: "shopping" },
      { amount: 90, category: "entertainment" },
      { amount: 90, category: "subscriptions" },
    ]);

    expect(slices.at(-1)?.kind).toBe("other");
    expect(slices.at(-1)?.amount).toBe(270);
  });

  it("breaks a tie in amount by taxonomy order", () => {
    expect(
      breakdownSlices([
        { amount: 500, category: "uncategorised" },
        { amount: 500, category: "taxes" },
        { amount: 500, category: "groceries" },
      ]).map((slice) => slice.kind === "category" && slice.category)
    ).toEqual(["groceries", "taxes", "uncategorised"]);
  });

  it("ranks uncategorised like any other category", () => {
    const slices = breakdownSlices([
      ...spendingIn(9),
      { amount: 50_000, category: "uncategorised" },
    ]);

    expect(slices[0]).toEqual({
      amount: 50_000,
      category: "uncategorised",
      kind: "category",
    });
  });

  it("renders nothing for no spending", () => {
    expect(breakdownSlices([])).toEqual([]);
  });
});

describe("isSliceSelected", () => {
  const slices = breakdownSlices(spendingIn(10));
  const other = slices.at(-1);

  it("selects other when the page filters on a category inside it", () => {
    expect(other && isSliceSelected(other, ["restaurants"])).toBe(true);
  });

  it("leaves other unselected when the filter keeps a shown category", () => {
    expect(other && isSliceSelected(other, ["health"])).toBe(false);
  });

  it("lists the categories other filters the page to", () => {
    expect(other && sliceCategories(other)).toEqual([
      "bills-utilities",
      "rent-mortgage",
      "restaurants",
      "groceries",
    ]);
  });
});
