import { describe, expect, test } from "bun:test";

import {
  categoryOfCategoryRef,
  monthSpan,
  periodMonthCount,
  plannedByCategory,
} from "./budget-planned";
import { CATEGORY_GROUP_FALLBACKS } from "./taxonomy";

const line = (
  amount: number,
  categorySlug: string | null,
  parentSlug: string | null = null
) => ({ amount, categorySlug, parentSlug });

describe("categoryOfCategoryRef", () => {
  test("keeps a current category as it is", () => {
    expect(categoryOfCategoryRef(line(0, "groceries"))).toBe("groceries");
  });

  test("resolves a legacy slug to its current category", () => {
    expect(categoryOfCategoryRef(line(0, "rent"))).toBe("rent-mortgage");
    expect(categoryOfCategoryRef(line(0, "home-insurance"))).toBe(
      "bills-utilities"
    );
  });

  test("sends a custom category to its parent group's catch-all", () => {
    expect(categoryOfCategoryRef(line(0, null, "income"))).toBe(
      CATEGORY_GROUP_FALLBACKS.income
    );

    expect(categoryOfCategoryRef(line(0, null, "investments"))).toBe(
      CATEGORY_GROUP_FALLBACKS.investments
    );

    expect(categoryOfCategoryRef(line(0, null, "spending"))).toBe(
      CATEGORY_GROUP_FALLBACKS.spending
    );
  });

  test("sends a custom category under a retired group to spending", () => {
    expect(categoryOfCategoryRef(line(0, null, "leisure"))).toBe(
      CATEGORY_GROUP_FALLBACKS.spending
    );
  });

  test("falls back to spending for a ref with nothing usable", () => {
    expect(categoryOfCategoryRef(line(0, null, null))).toBe(
      CATEGORY_GROUP_FALLBACKS.spending
    );

    expect(categoryOfCategoryRef(line(0, "not-a-category", "custom:abc"))).toBe(
      CATEGORY_GROUP_FALLBACKS.spending
    );
  });
});

describe("plannedByCategory", () => {
  test("maps a legacy slug to its current category", () => {
    const planned = plannedByCategory([line(120_000, "rent")], 1);

    expect(planned.get("rent-mortgage")).toBe(120_000);
    expect(planned.size).toBe(1);
  });

  test("maps a custom category to its parent group's catch-all", () => {
    const planned = plannedByCategory([line(4500, null, "leisure")], 1);

    expect(planned.get("uncategorised")).toBe(4500);
  });

  test("sums several lines landing in the same category", () => {
    const planned = plannedByCategory(
      [line(90_000, "rent"), line(1500, "mortgage")],
      1
    );

    expect(planned.get("rent-mortgage")).toBe(91_500);
    expect(planned.size).toBe(1);
  });

  test("keeps two categories of one group apart", () => {
    const planned = plannedByCategory(
      [line(90_000, "rent"), line(1500, "water")],
      1
    );

    expect(planned.get("rent-mortgage")).toBe(90_000);
    expect(planned.get("bills-utilities")).toBe(1500);
  });

  test("multiplies monthly amounts by the month count", () => {
    const planned = plannedByCategory(
      [line(2000, "water"), line(3000, "water")],
      3
    );

    expect(planned.get("bills-utilities")).toBe(15_000);
  });

  test("yields an empty map for no lines", () => {
    expect(plannedByCategory([], 12).size).toBe(0);
  });
});

describe("monthSpan", () => {
  test("counts one month for a single-month range", () => {
    expect(
      monthSpan(new Date(2026, 8, 1), new Date(2026, 8, 30, 23, 59, 59, 999))
    ).toBe(1);

    expect(
      monthSpan(new Date(2026, 1, 1), new Date(2026, 1, 28, 23, 59, 59, 999))
    ).toBe(1);
  });

  test("counts the months of a longer range", () => {
    expect(
      monthSpan(new Date(2026, 6, 1), new Date(2026, 8, 30, 23, 59, 59, 999))
    ).toBe(3);

    expect(
      monthSpan(new Date(2025, 9, 1), new Date(2026, 8, 30, 23, 59, 59, 999))
    ).toBe(12);
  });

  test("ignores the client's timezone offset on the boundaries", () => {
    const septemberStartAtUtcPlusTwo = new Date("2026-08-31T22:00:00.000Z");
    const septemberEndAtUtcPlusTwo = new Date("2026-09-30T21:59:59.999Z");

    expect(
      monthSpan(septemberStartAtUtcPlusTwo, septemberEndAtUtcPlusTwo)
    ).toBe(1);
  });
});

describe("periodMonthCount", () => {
  const now = new Date(2026, 8, 15, 12, 0, 0);

  test("leaves a finished month at its own span", () => {
    expect(
      periodMonthCount(
        new Date(2026, 7, 1),
        new Date(2026, 7, 31, 23, 59, 59, 999),
        now
      )
    ).toBe(1);
  });

  test("leaves a finished three-month range at three", () => {
    expect(
      periodMonthCount(
        new Date(2026, 4, 1),
        new Date(2026, 6, 31, 23, 59, 59, 999),
        now
      )
    ).toBe(3);
  });

  test("leaves a finished calendar year at twelve", () => {
    expect(
      periodMonthCount(
        new Date(2025, 0, 1),
        new Date(2025, 11, 31, 23, 59, 59, 999),
        now
      )
    ).toBe(12);
  });

  test("scales the running calendar year to its elapsed months", () => {
    expect(
      periodMonthCount(
        new Date(2026, 0, 1),
        new Date(2026, 11, 31, 23, 59, 59, 999),
        now
      )
    ).toBe(8);
  });

  test("floors a period that has not started at one month", () => {
    expect(
      periodMonthCount(
        new Date(2027, 0, 1),
        new Date(2027, 11, 31, 23, 59, 59, 999),
        now
      )
    ).toBe(1);
  });
});
