import type { CategoryEntry } from "@freenary/api/lib/categories";
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
  categoryEntryLabel,
  categoryMenuIcon,
  categoryRowMatches,
} from "@/entities/category";
import type { CategoryRow } from "@/entities/category";
import { m } from "@/paraglide/messages.js";

import { toCategorySections } from "../model/category-sections";

interface CategoryPickerProps {
  categories: CategoryEntry[];
  onCreateRequest: () => void;
  onSelect: (key: string) => void;
  value: string;
}

interface EntryRow extends CategoryRow {
  entry: CategoryEntry;
}

export const CategoryPicker = ({
  categories,
  onCreateRequest,
  onSelect,
  value,
}: CategoryPickerProps) => {
  const items = useMemo<EntryRow[]>(() => {
    const rows: EntryRow[] = [];

    for (const section of toCategorySections(categories, "")) {
      const heading = section.heading
        ? categoryEntryLabel(section.heading)
        : "";

      for (const entry of section.items) {
        rows.push({
          entry,
          group: heading,
          label: categoryEntryLabel(entry),
          value: entry.key,
        });
      }
    }

    return rows;
  }, [categories]);

  const selected = items.find((row) => row.value === value);

  return (
    <Combobox
      createLabel={() => m.settings_category_new_ellipsis()}
      filter={categoryRowMatches}
      items={items}
      onCreate={onCreateRequest}
      onValueChange={(next) => {
        if (next !== "") {
          onSelect(next);
        }
      }}
      value={value}
    >
      <ComboboxInput
        className="w-44 shrink-0"
        icon={selected ? categoryMenuIcon(selected.entry) : undefined}
        placeholder={m.settings_category_picker_placeholder()}
      />
      <ComboboxContent align="start">
        <ComboboxEmpty>{m.settings_category_search_empty()}</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            // SAFETY: every row comes from `items`, built above.
            const row = item as EntryRow;

            return (
              <ComboboxItem
                icon={categoryMenuIcon(row.entry)}
                value={row.value}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="truncate">{row.label}</span>
                  {row.group && (
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {row.group}
                    </span>
                  )}
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
