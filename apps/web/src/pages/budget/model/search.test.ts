import { describe, expect, it } from "bun:test";

import { budgetSearchSchema, nextBudgetSearch } from "./search";

describe("budgetSearchSchema", () => {
  it("drops an unknown category slug", () => {
    expect(
      budgetSearchSchema.parse({ cat: ["groceries", "not-a-category"] })
    ).toEqual({ cat: ["groceries"] });

    expect(budgetSearchSchema.parse({ cat: "not-a-category" })).toEqual({});
  });

  it("normalises a scalar category value to an array", () => {
    expect(budgetSearchSchema.parse({ cat: "groceries" })).toEqual({
      cat: ["groceries"],
    });

    expect(budgetSearchSchema.parse({ grp: "spending" })).toEqual({
      grp: ["spending"],
    });
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

  it("empties both category fields when the filter is cleared", () => {
    expect(
      nextBudgetSearch(
        { cat: ["groceries"], grp: ["spending"] },
        { cat: [], grp: [] }
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
