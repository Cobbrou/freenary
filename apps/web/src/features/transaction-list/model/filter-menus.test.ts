import { describe, expect, it } from "bun:test";

import { recentMonths, replacingField, singleValueOf } from "./filter-menus";

describe("replacingField", () => {
  it("swaps the filter of the same field and keeps the others", () => {
    expect(
      replacingField(
        [
          { field: "category", operator: "is", values: ["groceries"] },
          { field: "amount", operator: "gt", value: 5000 },
        ],
        { field: "category", operator: "is", values: ["restaurants"] }
      )
    ).toEqual([
      { field: "amount", operator: "gt", value: 5000 },
      { field: "category", operator: "is", values: ["restaurants"] },
    ]);
  });
});

describe("singleValueOf", () => {
  it("reads the one value a menu set, and nothing for richer filters", () => {
    expect(
      singleValueOf(
        [{ field: "account", operator: "is", values: ["livret"] }],
        "account"
      )
    ).toBe("livret");

    expect(
      singleValueOf(
        [{ field: "account", operator: "isAnyOf", values: ["a", "b"] }],
        "account"
      )
    ).toBeNull();
  });
});

describe("recentMonths", () => {
  it("lists the latest months with data, newest first, marking the one on screen", () => {
    expect(
      recentMonths({
        current: { month: 9, year: 2026 },
        first: new Date(2026, 8, 1),
        last: new Date(2026, 10, 1),
        locale: "en",
      })
    ).toEqual([
      { isCurrent: false, label: "November 2026", month: 10, year: 2026 },
      { isCurrent: true, label: "October 2026", month: 9, year: 2026 },
      { isCurrent: false, label: "September 2026", month: 8, year: 2026 },
    ]);
  });
});
