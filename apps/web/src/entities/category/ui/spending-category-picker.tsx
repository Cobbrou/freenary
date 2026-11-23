import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import type {
  SpendingCategory,
  TransactionDirection,
} from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
} from "@freenary/ui/components/command-menu";
import type { CommandMenuItemData } from "@freenary/ui/components/command-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import { RiCheckLine, RiExpandUpDownLine } from "@remixicon/react";
import { useMemo, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import {
  categoryPickerRowMatches,
  categoryPickerRows,
  withMatchRows,
} from "../model/category-picker-rows";
import { categoryLabel } from "../model/taxonomy-labels";
import { useCategorySuggestions } from "../model/use-category-suggestions";
import { categoryMenuIcon } from "./category-menu-icon";

interface SpendingCategoryPickerProps {
  className?: string;
  currency?: string;
  direction: TransactionDirection;
  onValueChange: (value: SpendingCategory) => void;
  value: SpendingCategory;
}

const EXPAND_ICON = remixIcon(RiExpandUpDownLine);

export const SpendingCategoryPicker = ({
  className,
  currency,
  direction,
  onValueChange,
  value,
}: SpendingCategoryPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestions = useCategorySuggestions({
    currency,
    direction,
    open,
    query,
  });

  const rows = useMemo(() => categoryPickerRows(direction), [direction]);
  const shown = useMemo(
    () => withMatchRows(rows, suggestions.categories),
    [rows, suggestions.categories]
  );

  const rowsByValue = useMemo(
    () => new Map(shown.map((row) => [row.value, row])),
    [shown]
  );

  const items = useMemo<CommandMenuItemData[]>(() => {
    const matchesLabel = m.budget_category_matches_label();

    return shown.map((row) => ({
      group: row.isMatch ? matchesLabel : row.group,
      icon: categoryMenuIcon(predefinedCategoryAppearance(row.category)),
      label: row.label,
      value: row.value,
    }));
  }, [shown]);

  const changeOpen = (next: boolean) => {
    setOpen(next);

    if (next) {
      setQuery("");
    }
  };

  const pick = (item: CommandMenuItemData) => {
    const row = rowsByValue.get(item.value);

    if (row === undefined) {
      return;
    }

    setOpen(false);

    if (row.category !== value) {
      onValueChange(row.category);
    }
  };

  const filter = (item: CommandMenuItemData, typed: string) => {
    const row = rowsByValue.get(item.value);

    return row !== undefined && categoryPickerRowMatches(row, typed);
  };

  return (
    <Popover onOpenChange={changeOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={m.budget_category_picker_trigger({
              category: categoryLabel(value),
            })}
            className={className}
            leadingIcon={categoryMenuIcon(predefinedCategoryAppearance(value))}
            trailingIcon={EXPAND_ICON}
            variant="secondary"
          />
        }
      >
        <span className="block max-w-48 truncate">{categoryLabel(value)}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={m.budget_category_picker_title()}
        className="max-h-[min(380px,var(--available-height))] w-64 gap-0 overflow-hidden p-0"
        initialFocus={searchRef}
      >
        <CommandMenu
          filter={filter}
          items={items}
          onQueryChange={setQuery}
          onSelect={pick}
          query={query}
        >
          <CommandMenuInput
            aria-label={m.budget_category_picker_title()}
            ref={searchRef}
            placeholder={m.budget_category_search_placeholder()}
          />
          <CommandMenuList
            renderItem={(item) => {
              const row = rowsByValue.get(item.value);
              const isCurrent =
                row?.isMatch === false && row.category === value;

              return (
                <CommandMenuItem
                  aria-current={isCurrent || undefined}
                  value={item.value}
                >
                  <span className="-my-1 min-w-0 flex-1 truncate py-1 [text-box:trim-both_cap_alphabetic]">
                    {item.label}
                  </span>
                  {isCurrent ? (
                    <RiCheckLine
                      aria-hidden
                      className="text-foreground size-3.5 shrink-0"
                    />
                  ) : null}
                </CommandMenuItem>
              );
            }}
          >
            <CommandMenuEmpty>
              {suggestions.isSearching
                ? m.budget_category_matches_searching()
                : m.budget_category_search_empty()}
            </CommandMenuEmpty>
          </CommandMenuList>
        </CommandMenu>
      </PopoverContent>
    </Popover>
  );
};
