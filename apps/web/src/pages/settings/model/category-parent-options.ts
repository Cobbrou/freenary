import { categoryGroupAppearance } from "@freenary/api/lib/categories";
import type { CategoryEntry } from "@freenary/api/lib/categories";
import { CATEGORY_GROUPS } from "@freenary/api/lib/taxonomy";

import { categoryEntryLabel, categoryGroupLabel } from "@/entities/category";

import type { CategoryParentOption } from "../ui/category-parent-select";

interface CategoryParentOptionsInput {
  categories: CategoryEntry[];
  editedHasSubcategories: boolean;
  editedKey: string | null;
}

export const categoryParentOptions = ({
  categories,
  editedHasSubcategories,
  editedKey,
}: CategoryParentOptionsInput): CategoryParentOption[] => {
  if (editedHasSubcategories) {
    return [];
  }

  const groups: CategoryParentOption[] = CATEGORY_GROUPS.map((group) => ({
    appearance: categoryGroupAppearance(group),
    key: group,
    label: categoryGroupLabel(group),
  }));

  const own: CategoryParentOption[] = categories.flatMap((entry) =>
    entry.isGroup && entry.isCustom && entry.key !== editedKey
      ? [
          {
            appearance: {
              color: entry.pickedColor ?? entry.color,
              icon: entry.icon,
            },
            key: entry.key,
            label: categoryEntryLabel(entry),
          },
        ]
      : []
  );

  return [...groups, ...own];
};
