import { describe, expect, it } from "bun:test";

import { SPENDING_CATEGORIES } from "../../src/lib/taxonomy";
import { categoryPriority } from "./category-priority";

describe("categoryPriority", () => {
  it("keeps groceries above eating out, so a supermarket with a cafe stays a supermarket", () => {
    expect(categoryPriority("groceries")).toBeGreaterThan(
      categoryPriority("restaurants")
    );
  });

  it("keeps a fuel forecourt and a generic aisle the most incidental of all", () => {
    for (const specific of [
      "groceries",
      "health",
      "transport-travel",
    ] as const) {
      expect(categoryPriority(specific)).toBeGreaterThan(
        categoryPriority("car-fuel")
      );

      expect(categoryPriority(specific)).toBeGreaterThan(
        categoryPriority("shopping")
      );
    }
  });

  it("ranks a brand with only fuel entries above nothing at all", () => {
    expect(categoryPriority("car-fuel")).toBeGreaterThan(
      categoryPriority("uncategorised")
    );
  });

  it("gives every spending category a rung", () => {
    for (const category of SPENDING_CATEGORIES) {
      const priority = categoryPriority(category);

      expect(Number.isInteger(priority)).toBe(true);
      expect(priority).toBeGreaterThanOrEqual(0);
    }
  });
});
