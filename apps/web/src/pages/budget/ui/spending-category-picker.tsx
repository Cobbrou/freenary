import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import {
  categoriesForDirection,
  CATEGORY_GROUP_OF,
} from "@freenary/api/lib/taxonomy";
import type {
  SpendingCategory,
  TransactionDirection,
} from "@freenary/api/lib/taxonomy";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@freenary/ui/components/combobox";
import { useMemo } from "react";

import {
  categoryGroupLabel,
  categoryLabel,
  categoryMenuIcon,
  categoryRowMatches,
} from "@/entities/category";
import type { CategoryRow } from "@/entities/category";
import { m } from "@/paraglide/messages.js";

interface SpendingCategoryPickerProps {
  direction: TransactionDirection;
  onValueChange: (value: SpendingCategory) => void;
  value: SpendingCategory;
}

export const SpendingCategoryPicker = ({
  direction,
  onValueChange,
  value,
}: SpendingCategoryPickerProps) => {
  const items = useMemo<CategoryRow[]>(
    () =>
      categoriesForDirection(direction).map((category) => ({
        group: categoryGroupLabel(CATEGORY_GROUP_OF[category]),
        label: categoryLabel(category),
        value: category,
      })),
    [direction]
  );

  return (
    <Combobox
      filter={categoryRowMatches}
      items={items}
      onValueChange={(next) => {
        if (next !== "") {
          // SAFETY: every row's value is a SpendingCategory from the taxonomy.
          onValueChange(next as SpendingCategory);
        }
      }}
      value={value}
    >
      <ComboboxInput
        icon={categoryMenuIcon(predefinedCategoryAppearance(value))}
        placeholder={m.budget_category_search_placeholder()}
      />
      <ComboboxContent align="start">
        <ComboboxEmpty>{m.budget_category_search_empty()}</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            // SAFETY: every row comes from `items`, built above.
            const row = item as CategoryRow;

            // SAFETY: as above — the rows come from the taxonomy.
            const category = row.value as SpendingCategory;

            return (
              <ComboboxItem
                icon={categoryMenuIcon(predefinedCategoryAppearance(category))}
                value={row.value}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="truncate">{row.label}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {row.group}
                  </span>
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
