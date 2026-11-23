import {
  CATEGORY_GROUP_OF,
  categoriesForDirection,
} from "@freenary/api/lib/taxonomy";
import type {
  SpendingCategory,
  TransactionDirection,
} from "@freenary/api/lib/taxonomy";

import type { CategoryRow } from "./category-search";
import { categoryRowMatches } from "./category-search";
import { categoryGroupLabel, categoryLabel } from "./taxonomy-labels";

const MATCH_PREFIX = "match:";

export interface CategoryPickerRow extends CategoryRow {
  category: SpendingCategory;
  isMatch: boolean;
}

const rowOf = (
  category: SpendingCategory,
  value: string,
  isMatch: boolean
): CategoryPickerRow => ({
  category,
  group: categoryGroupLabel(CATEGORY_GROUP_OF[category]),
  isMatch,
  label: categoryLabel(category),
  value,
});

export const categoryPickerRows = (
  direction: TransactionDirection
): CategoryPickerRow[] =>
  categoriesForDirection(direction).map((category) =>
    rowOf(category, category, false)
  );

export const withMatchRows = (
  rows: readonly CategoryPickerRow[],
  matches: readonly SpendingCategory[]
): readonly CategoryPickerRow[] => {
  const offered = matches.filter((category) =>
    rows.some((row) => row.category === category)
  );

  if (offered.length === 0) {
    return rows;
  }

  return [
    ...rows,
    ...offered.map((category) =>
      rowOf(category, `${MATCH_PREFIX}${category}`, true)
    ),
  ];
};

export const categoryPickerRowMatches = (
  row: CategoryPickerRow,
  query: string
): boolean => row.isMatch || categoryRowMatches(row, query);
