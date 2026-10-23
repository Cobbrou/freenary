import type { CategoryEntry } from "@freenary/api/lib/categories";

import { categoryEntryLabel } from "@/entities/category";
import { foldForSearch } from "@/shared/lib/search-text";

import type { EditedCustomCategory } from "./use-custom-category-form";

export interface CategorySection {
  heading: CategoryEntry | null;
  items: CategoryEntry[];
  key: string;
}

export interface CategoryTreeGroup {
  children: CategoryEntry[];
  group: CategoryEntry;
}

export const toCustomCategoryTree = (
  categories: CategoryEntry[]
): CategoryTreeGroup[] => {
  const tree: CategoryTreeGroup[] = [];

  for (const entry of categories) {
    if (entry.isGroup) {
      tree.push({ children: [], group: entry });
    } else if (entry.isCustom) {
      tree.at(-1)?.children.push(entry);
    }
  }

  return tree.filter(
    ({ children, group }) => group.isCustom || children.length > 0
  );
};

export const editedOf = (entry: CategoryEntry): EditedCustomCategory => ({
  color: entry.pickedColor ?? entry.color,
  icon: entry.icon,
  id: entry.key.split(":")[1] ?? "",
  label: entry.label,
  parentKey: entry.parentKey,
});

export const toCategorySections = (
  categories: CategoryEntry[],
  query: string
): CategorySection[] => {
  const needle = foldForSearch(query.trim());
  const sections: CategorySection[] = [];

  for (const entry of categories) {
    const isPredefinedGroup = entry.isGroup && !entry.isCustom;

    if (isPredefinedGroup) {
      sections.push({ heading: entry, items: [], key: entry.key });

      continue;
    }

    const matchesTranslatedLabel =
      !needle ||
      (entry.isAssignable &&
        foldForSearch(categoryEntryLabel(entry)).includes(needle));

    if (!matchesTranslatedLabel) {
      continue;
    }

    const parentSection = sections.find(
      (section) => section.key === entry.parentKey
    );

    if (parentSection) {
      parentSection.items.push(entry);

      continue;
    }

    sections.push({
      heading: null,
      items: [entry],
      key: entry.parentKey ?? entry.key,
    });
  }

  return sections.filter((section) => section.items.length > 0);
};
