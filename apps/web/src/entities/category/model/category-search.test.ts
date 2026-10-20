import { describe, expect, it } from "bun:test";

import { CATEGORY_GROUPS, categoriesInGroup } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import { categoryRowMatches } from "./category-search";
import { categoryLabel, categoryGroupLabel } from "./taxonomy-labels";

const rows = CATEGORY_GROUPS.flatMap((group) =>
  categoriesInGroup(group).map((category) => ({
    category,
    group: categoryGroupLabel(group),
    label: categoryLabel(category),
    value: category,
  }))
);

const matching = (query: string): SpendingCategory[] =>
  rows.flatMap((row) => (categoryRowMatches(row, query) ? [row.value] : []));

describe("categoryRowMatches", () => {
  it("offers the whole taxonomy when nothing is typed", () => {
    for (const query of ["", "   "]) {
      expect(matching(query)).toEqual(rows.map((row) => row.value));
    }
  });

  it("keeps every category of a group whose own name matches", () => {
    expect(matching("income")).toEqual([...categoriesInGroup("income")]);
  });

  it("keeps only the matching categories of a group named otherwise", () => {
    expect(matching("groceries")).toEqual(["groceries"]);
  });

  it("matches a label and a group name typed without their accents", () => {
    const accentedRow = {
      group: "Épargne et placements",
      label: "Retraite et épargne long terme",
      value: "retirement",
    };

    expect(categoryRowMatches(accentedRow, "epargne long")).toBe(true);
    expect(categoryRowMatches(accentedRow, "epargne et placements")).toBe(true);
    expect(categoryRowMatches(accentedRow, "courses")).toBe(false);
  });

  it("returns nothing when no label matches", () => {
    expect(matching("zzz")).toEqual([]);
  });
});
