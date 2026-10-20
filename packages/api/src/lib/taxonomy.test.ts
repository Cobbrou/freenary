import { describe, expect, it } from "bun:test";

import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_DIRECTION_OF,
  CATEGORY_GROUP_FALLBACKS,
  CATEGORY_GROUP_LABELS,
  CATEGORY_GROUP_OF,
  CATEGORY_GROUPS,
  CATEGORY_ICON_NAMES,
  CATEGORY_LABELS,
  LEGACY_CATEGORY_GROUPS,
  LEGACY_CATEGORY_SLUGS,
  SPENDING_CATEGORIES,
  categoriesForDirection,
  categoriesInGroup,
  categoryColor,
  categoryDirection,
  categoryIcon,
  isCategoryGroup,
  isSpendingCategory,
  resolveCategoryGroup,
  resolveCategorySlug,
} from "./taxonomy";
import type { CategoryGroup } from "./taxonomy";

describe("category hierarchy", () => {
  it("gives every category a group, a label and an appearance", () => {
    for (const category of SPENDING_CATEGORIES) {
      const group = CATEGORY_GROUP_OF[category];

      expect(CATEGORY_GROUPS).toContain(group);
      expect(CATEGORY_LABELS[category]).toBeTruthy();
      expect(CATEGORY_COLOR_VALUES).toContain(categoryColor(category));
      expect(CATEGORY_ICON_NAMES).toContain(categoryIcon(category));
    }
  });

  it("partitions the categories across the groups", () => {
    const seen = new Set<string>();

    for (const group of CATEGORY_GROUPS) {
      const categories = categoriesInGroup(group);

      expect(categories.length).toBeGreaterThan(0);

      for (const category of categories) {
        expect(seen.has(category)).toBe(false);

        seen.add(category);
      }
    }

    expect(seen.size).toBe(SPENDING_CATEGORIES.length);
  });

  it("keeps each group's categories contiguous and in group order", () => {
    const order = SPENDING_CATEGORIES.map(
      (category) => CATEGORY_GROUP_OF[category]
    );

    const runs: CategoryGroup[] = [];

    for (const group of order) {
      if (runs.at(-1) !== group) {
        runs.push(group);
      }
    }

    expect(runs).toEqual([...CATEGORY_GROUPS]);
  });

  it("points every group fallback at a category of that same group", () => {
    for (const group of CATEGORY_GROUPS) {
      const fallback = CATEGORY_GROUP_FALLBACKS[group];

      expect(isSpendingCategory(fallback)).toBe(true);
      expect(CATEGORY_GROUP_OF[fallback]).toBe(group);
    }
  });

  it("labels every group", () => {
    for (const group of CATEGORY_GROUPS) {
      expect(CATEGORY_GROUP_LABELS[group]).toBeTruthy();
      expect(isCategoryGroup(group)).toBe(true);
    }
  });

  it("separates the group and category key spaces", () => {
    for (const group of CATEGORY_GROUPS) {
      expect(isSpendingCategory(group)).toBe(false);
    }

    for (const category of SPENDING_CATEGORIES) {
      expect(isCategoryGroup(category)).toBe(false);
    }
  });
});

describe("resolveCategorySlug", () => {
  it("returns every current category unchanged", () => {
    for (const category of SPENDING_CATEGORIES) {
      expect(resolveCategorySlug(category)).toBe(category);
    }
  });

  it("maps every legacy slug to a current category", () => {
    for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_SLUGS)) {
      expect(resolveCategorySlug(legacy)).toBe(current);
      expect(isSpendingCategory(current)).toBe(true);
    }
  });

  it("sends a slug that is also a group to that group's catch-all", () => {
    for (const group of CATEGORY_GROUPS) {
      if (Object.hasOwn(LEGACY_CATEGORY_SLUGS, group)) {
        expect(resolveCategorySlug(group)).toBe(
          CATEGORY_GROUP_FALLBACKS[group]
        );
      }
    }
  });

  it("covers the whole flat set that preceded the hierarchy", () => {
    const flatSet = [
      "dining",
      "education",
      "entertainment",
      "groceries",
      "health",
      "housing",
      "income",
      "insurance",
      "other",
      "savings",
      "shopping",
      "subscriptions",
      "taxes",
      "transfers",
      "transport",
      "travel",
      "utilities",
    ];

    for (const legacy of flatSet) {
      expect(resolveCategorySlug(legacy)).not.toBeNull();
    }
  });

  it("returns null for an unknown value", () => {
    expect(resolveCategorySlug("")).toBeNull();
    expect(resolveCategorySlug("not-a-category")).toBeNull();
    expect(resolveCategorySlug("Groceries")).toBeNull();
  });
});

describe("resolveCategoryGroup", () => {
  it("returns every current group unchanged", () => {
    for (const group of CATEGORY_GROUPS) {
      expect(resolveCategoryGroup(group)).toBe(group);
    }
  });

  it("maps every retired group to a current one", () => {
    for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_GROUPS)) {
      expect(resolveCategoryGroup(legacy)).toBe(current);
      expect(isCategoryGroup(current)).toBe(true);
    }
  });

  it("returns null for a value that names no group", () => {
    expect(resolveCategoryGroup("")).toBeNull();
    expect(resolveCategoryGroup("custom:abc123")).toBeNull();
    expect(resolveCategoryGroup("groceries")).toBeNull();
  });
});

describe("categoriesForDirection", () => {
  const incoming = categoriesForDirection("incoming");
  const outgoing = categoriesForDirection("outgoing");

  it("offers only current categories", () => {
    for (const category of [...incoming, ...outgoing]) {
      expect(SPENDING_CATEGORIES).toContain(category);
    }
  });

  it("offers every both-way category in both directions", () => {
    const bothWays = SPENDING_CATEGORIES.filter(
      (category) => categoryDirection(category) === "both"
    );

    expect(bothWays.length).toBeGreaterThan(0);

    for (const category of bothWays) {
      expect(incoming).toContain(category);
      expect(outgoing).toContain(category);
    }
  });

  it("keeps the one-way categories to their own direction", () => {
    for (const category of SPENDING_CATEGORIES) {
      const direction = CATEGORY_DIRECTION_OF[category];

      if (direction === "both") {
        continue;
      }

      expect(incoming.includes(category)).toBe(direction === "in");
      expect(outgoing.includes(category)).toBe(direction === "out");
    }
  });

  it("covers the whole set across the two directions", () => {
    expect(new Set([...incoming, ...outgoing]).size).toBe(
      SPENDING_CATEGORIES.length
    );
  });
});
