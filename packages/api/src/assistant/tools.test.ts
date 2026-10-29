import { describe, expect, it } from "bun:test";

import { MAX_FILTER_AMOUNT_MINOR_UNITS } from "../lib/transaction-filters";
import { searchFilters } from "./tools";

describe("searchFilters", () => {
  it("builds no filter when the assistant asks for none", () => {
    expect(searchFilters({})).toEqual([]);
  });

  it("merges categories and groups into one category filter", () => {
    expect(
      searchFilters({ categories: ["groceries"], groups: ["income"] })
    ).toEqual([
      {
        field: "category",
        operator: "isAnyOf",
        values: ["groceries", "income"],
      },
    ]);
  });

  it("keeps both bounds inclusive in minor units", () => {
    expect(searchFilters({ maxAmount: 80, minAmount: 50 })).toEqual([
      { field: "amount", operator: "gt", value: 4999 },
      { field: "amount", operator: "lt", value: 8001 },
    ]);
  });

  it("drops a zero floor, and caps a ceiling the schema would refuse", () => {
    expect(searchFilters({ maxAmount: 1e12, minAmount: 0 })).toEqual([
      { field: "amount", operator: "lt", value: MAX_FILTER_AMOUNT_MINOR_UNITS },
    ]);
  });
});
