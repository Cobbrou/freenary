import {
  CATEGORY_GROUP_COLORS,
  CATEGORY_GROUP_ICONS,
  CATEGORY_GROUP_LABELS,
  CATEGORY_GROUPS,
  CATEGORY_LABELS,
  categoriesInGroup,
  categoryColor,
  categoryIcon,
  categoryPaletteSlot,
  isCategoryColor,
  isSpendingCategory,
  resolveCategoryGroup,
} from "./taxonomy";
import type {
  CategoryColor,
  CategoryGroup,
  CategoryIconName,
  CategoryPaletteSlot,
  SpendingCategory,
} from "./taxonomy";

export interface CategoryEntry {
  color: CategoryColor;
  pickedColor?: CategoryColor;
  icon: CategoryIconName;
  isCustom: boolean;
  isGroup: boolean;
  isAssignable: boolean;
  key: string;
  label: string;
  parentKey: string | null;
  slot?: CategoryPaletteSlot;
  usageCount: number;
}

export interface CategoryAppearance {
  color: CategoryColor;
  icon: CategoryIconName;
  slot?: CategoryPaletteSlot;
}

export interface PredefinedCategoryGroup {
  categories: CategoryEntry[];
  group: CategoryEntry;
}

const COLOR_OF_AN_UNREADABLE_CHOICE: CategoryColor = "grey";

export const CUSTOM_CATEGORY_PREFIX = "custom:";

export const customCategoryKey = (id: string): string =>
  `${CUSTOM_CATEGORY_PREFIX}${id}`;

export const parseCategoryKey = (
  key: string
):
  | { customId: string; slug: null }
  | { customId: null; slug: SpendingCategory }
  | null => {
  if (key.startsWith(CUSTOM_CATEGORY_PREFIX)) {
    const customId = key.slice(CUSTOM_CATEGORY_PREFIX.length);

    return customId ? { customId, slug: null } : null;
  }

  return isSpendingCategory(key) ? { customId: null, slug: key } : null;
};

export const predefinedCategoryAppearance = (
  category: SpendingCategory
): CategoryAppearance => ({
  color: categoryColor(category),
  icon: categoryIcon(category),
  slot: categoryPaletteSlot(category),
});

export const categoryGroupAppearance = (
  group: CategoryGroup
): CategoryAppearance => ({
  color: CATEGORY_GROUP_COLORS[group],
  icon: CATEGORY_GROUP_ICONS[group],
});

export const customCategoryPickedColor = (chosen: string): CategoryColor =>
  isCategoryColor(chosen) ? chosen : COLOR_OF_AN_UNREADABLE_CHOICE;

export const customCategoryColor = (
  parentSlug: string | null,
  chosen: string
): CategoryColor => {
  const parentGroup =
    parentSlug === null ? null : resolveCategoryGroup(parentSlug);

  if (parentGroup) {
    return CATEGORY_GROUP_COLORS[parentGroup];
  }

  return customCategoryPickedColor(chosen);
};

export const customCategoryDisplayColor = (row: {
  chosen: string;
  parentChosenColor: string | null;
  parentSlug: string | null;
}): CategoryColor =>
  row.parentChosenColor === null
    ? customCategoryColor(row.parentSlug, row.chosen)
    : customCategoryPickedColor(row.parentChosenColor);

const groupEntry = (group: CategoryGroup): CategoryEntry => ({
  color: CATEGORY_GROUP_COLORS[group],
  icon: CATEGORY_GROUP_ICONS[group],
  isAssignable: false,
  isCustom: false,
  isGroup: true,
  key: group,
  label: CATEGORY_GROUP_LABELS[group],
  parentKey: null,
  usageCount: 0,
});

const categoryEntry = (
  category: SpendingCategory,
  group: CategoryGroup
): CategoryEntry => ({
  color: categoryColor(category),
  icon: categoryIcon(category),
  isAssignable: true,
  isCustom: false,
  isGroup: false,
  key: category,
  label: CATEGORY_LABELS[category],
  parentKey: group,
  slot: categoryPaletteSlot(category),
  usageCount: 0,
});

export const predefinedCategoryGroups = (): PredefinedCategoryGroup[] =>
  CATEGORY_GROUPS.map((group) => ({
    categories: categoriesInGroup(group).map((category) =>
      categoryEntry(category, group)
    ),
    group: groupEntry(group),
  }));
