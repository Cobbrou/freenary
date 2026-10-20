import {
  categoryGroupAppearance,
  predefinedCategoryAppearance,
} from "@freenary/api/lib/categories";
import { CATEGORY_GROUPS, categoriesInGroup } from "@freenary/api/lib/taxonomy";
import type {
  CategoryGroup,
  SpendingCategory,
} from "@freenary/api/lib/taxonomy";
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@freenary/ui/components/combobox";
import { RiFilter3Line } from "@remixicon/react";
import { useMemo } from "react";

import {
  categoryGroupLabel,
  categoryLabel,
  categoryMenuIcon,
  categoryRowMatches,
  EMPTY_CATEGORY_FILTER,
  toggleCategory,
  toggleGroup,
} from "@/entities/category";
import type { CategoryFilter, CategoryRow } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

interface CategoryFilterMenuProps {
  filter: CategoryFilter;
  onFilterChange: (filter: CategoryFilter) => void;
}

const GROUP_PREFIX = "g:";
const CATEGORY_PREFIX = "c:";
const groupValue = (group: CategoryGroup) => `${GROUP_PREFIX}${group}`;

const categoryValue = (category: SpendingCategory) =>
  `${CATEGORY_PREFIX}${category}`;

// SAFETY: only `groupValue` mints a `g:` value, and only from the taxonomy.
const groupOf = (value: string): CategoryGroup =>
  value.slice(GROUP_PREFIX.length) as CategoryGroup;

// SAFETY: only `categoryValue` mints a `c:` value, and only from the taxonomy.
const categoryOf = (value: string): SpendingCategory =>
  value.slice(CATEGORY_PREFIX.length) as SpendingCategory;

export const CategoryFilterMenu = ({
  filter,
  onFilterChange,
}: CategoryFilterMenuProps) => {
  const items = useMemo<CategoryRow[]>(() => {
    const rows: CategoryRow[] = [];

    for (const group of CATEGORY_GROUPS) {
      const groupName = categoryGroupLabel(group);

      rows.push({
        group: groupName,
        label: groupName,
        value: groupValue(group),
      });

      if (filter.groups.includes(group)) {
        continue;
      }

      for (const category of categoriesInGroup(group)) {
        rows.push({
          group: groupName,
          label: categoryLabel(category),
          value: categoryValue(category),
        });
      }
    }

    return rows;
  }, [filter.groups]);

  const values = useMemo(
    () => [
      ...filter.groups.map(groupValue),
      ...filter.categories.map(categoryValue),
    ],
    [filter]
  );

  const handleChange = (next: string[]) => {
    if (next.length === 0) {
      onFilterChange(EMPTY_CATEGORY_FILTER);

      return;
    }

    const changed =
      next.find((value) => !values.includes(value)) ??
      values.find((value) => !next.includes(value));

    if (changed === undefined) {
      return;
    }

    onFilterChange(
      changed.startsWith(GROUP_PREFIX)
        ? toggleGroup(filter, groupOf(changed))
        : toggleCategory(filter, categoryOf(changed))
    );
  };

  return (
    <Combobox
      filter={categoryRowMatches}
      items={items}
      multiple
      onValueChange={handleChange}
      value={values}
    >
      <ComboboxChips
        className="min-w-52"
        clearable
        icon={remixIcon(RiFilter3Line)}
        placeholder={m.budget_filter_category()}
      />
      <ComboboxContent align="start">
        <ComboboxEmpty>{m.budget_category_search_empty()}</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            // SAFETY: every row comes from `items`, built above.
            const row = item as CategoryRow;
            const isGroup = row.value.startsWith(GROUP_PREFIX);

            return (
              <ComboboxItem
                icon={categoryMenuIcon(
                  isGroup
                    ? categoryGroupAppearance(groupOf(row.value))
                    : predefinedCategoryAppearance(categoryOf(row.value))
                )}
                value={row.value}
              >
                <span className={isGroup ? "font-medium" : "ps-3"}>
                  {row.label}
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
