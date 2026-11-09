import { describe, expect, it } from "bun:test";

import { MAX_FILTER_AMOUNT_MINOR_UNITS } from "../lib/transaction-filters";
import { searchFilters } from "./tools";

describe("searchFilters", () => {
  it("builds no filter when the assistant asks for none", () => {
    expect(searchFilters({}, "EUR")).toEqual([]);
  });

  it("merges categories and groups into one category filter", () => {
    expect(
      searchFilters({ categories: ["groceries"], groups: ["income"] }, "EUR")
    ).toEqual([
      {
        field: "category",
        operator: "isAnyOf",
        values: ["groceries", "income"],
      },
    ]);
  });

  it("keeps both bounds inclusive in minor units", () => {
    expect(searchFilters({ maxAmount: 80, minAmount: 50 }, "EUR")).toEqual([
      { field: "amount", operator: "gt", value: 4999 },
      { field: "amount", operator: "lt", value: 8001 },
    ]);
  });

  it("reads the minor-unit digits from the currency", () => {
    expect(searchFilters({ maxAmount: 80, minAmount: 50 }, "JPY")).toEqual([
      { field: "amount", operator: "gt", value: 49 },
      { field: "amount", operator: "lt", value: 81 },
    ]);
  });

  it("drops a zero floor, and caps a ceiling the schema would refuse", () => {
    expect(searchFilters({ maxAmount: 1e12, minAmount: 0 }, "EUR")).toEqual([
      { field: "amount", operator: "lt", value: MAX_FILTER_AMOUNT_MINOR_UNITS },
    ]);
  });
});
