import { describe, expect, it } from "bun:test";

import { budgetSearchSchema, nextBudgetSearch } from "./search";

describe("budgetSearchSchema", () => {
  it("drops a filter that does not parse and keeps the rest", () => {
    expect(
      budgetSearchSchema.parse({
        filters: [
          { field: "category", operator: "is", values: ["groceries"] },
          { field: "category", operator: "is", values: ["not-a-category"] },
          { field: "company", operator: "is", values: ["Uber", "Lyft"] },
          { field: "amount", operator: "gt", value: 5000 },
        ],
      })
    ).toEqual({
      filters: [
        { field: "category", operator: "is", values: ["groceries"] },
        { field: "amount", operator: "gt", value: 5000 },
      ],
    });
  });

  it("reads a filters param that is not a list as absent", () => {
    expect(budgetSearchSchema.parse({ filters: "groceries" })).toEqual({});
    expect(budgetSearchSchema.parse({ filters: [] })).toEqual({});
  });

  it("reads a mangled param as absent", () => {
    expect(
      budgetSearchSchema.parse({ agg: "nope", month: 42, range: "7Y" })
    ).toEqual({});
  });

  it("keeps a valid view", () => {
    expect(
      budgetSearchSchema.parse({
        agg: "median",
        month: 7,
        q: "orange",
        range: "3M",
        year: 2026,
      })
    ).toEqual({
      agg: "median",
      month: 7,
      q: "orange",
      range: "3M",
      year: 2026,
    });
  });
});

describe("nextBudgetSearch", () => {
  it("keeps a non-default value", () => {
    expect(nextBudgetSearch({}, { sort: "amount" })).toEqual({
      sort: "amount",
    });

    expect(nextBudgetSearch({ range: "3M" }, { agg: "median" })).toEqual({
      agg: "median",
      range: "3M",
    });
  });

  it("removes a field returned to its default", () => {
    expect(nextBudgetSearch({ sort: "amount" }, { sort: "date" })).toEqual({});
    expect(
      nextBudgetSearch({ q: "orange", view: "categories" }, { q: "" })
    ).toEqual({ view: "categories" });
  });

  it("leaves untouched fields alone", () => {
    expect(
      nextBudgetSearch({ month: 7, year: 2026 }, { dir: "incoming" })
    ).toEqual({ dir: "incoming", month: 7, year: 2026 });
  });

  it("removes the filters when the last one goes", () => {
    expect(
      nextBudgetSearch(
        {
          filters: [{ field: "amount", operator: "lt", value: 100 }],
        },
        { filters: [] }
      )
    ).toEqual({});
  });

  it("keeps January, which is not a default", () => {
    expect(nextBudgetSearch({}, { month: 0, year: 2026 })).toEqual({
      month: 0,
      year: 2026,
    });
  });
});
