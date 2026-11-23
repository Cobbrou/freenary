import { MAX_SAVED_FILTER_NAME_LENGTH } from "@freenary/api/lib/transaction-filters";
import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { Button } from "@freenary/ui/components/button";
import { Input } from "@freenary/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { RiBookmarkLine, RiCheckLine, RiDeleteBinLine } from "@remixicon/react";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import { searchKey } from "../model/filter-tokens";
import { useSavedFilters } from "../model/use-saved-filters";
import type { SavedFilter } from "../model/use-saved-filters";

interface SavedFiltersMenuProps {
  filters: TransactionFilter[];
  onApply: (saved: { filters: TransactionFilter[]; search: string }) => void;
  search: string;
}

const SKELETON_ROWS = ["first", "second"] as const;

const summaryOf = ({ filters, search }: SavedFilter): string => {
  const text = search.trim();

  if (filters.length === 0) {
    return m.budget_saved_filter_search_only({ search: text });
  }

  return text === ""
    ? m.budget_saved_filter_count({ count: filters.length })
    : m.budget_saved_filter_count_with_search({
        count: filters.length,
        search: text,
      });
};

const SavedFilterListSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-1.5 px-2 py-1">
    <output className="sr-only">{m.budget_saved_filters_loading()}</output>
    {SKELETON_ROWS.map((row) => (
      <div aria-hidden="true" className="flex flex-col gap-1 py-1" key={row}>
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    ))}
  </div>
);

export const SavedFiltersMenu = ({
  filters,
  onApply,
  search,
}: SavedFiltersMenuProps) => {
  const nameId = useId();
  const hintId = useId();
  const locale = getLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const {
    deleteSavedFilter,
    deletingId,
    isSaving,
    saveFilter,
    savedFiltersQuery,
  } = useSavedFilters({ isListShown: isOpen });

  const savedFilters = savedFiltersQuery.data?.savedFilters ?? [];
  const currentKey = searchKey(filters, search);
  const hasSomethingToSave = filters.length > 0 || search.trim() !== "";
  const trimmedName = name.trim();
  const replaced = savedFilters.find(
    (saved) =>
      saved.name.toLocaleLowerCase(locale) ===
      trimmedName.toLocaleLowerCase(locale)
  );

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasSomethingToSave || trimmedName === "") {
      return;
    }

    saveFilter(
      { filters, name: trimmedName, search },
      { onSuccess: () => setName("") }
    );
  };

  const applySaved = (saved: SavedFilter) => {
    onApply({ filters: saved.filters, search: saved.search });
    setIsOpen(false);
  };

  const listOf = () => {
    if (savedFiltersQuery.isPending) {
      return <SavedFilterListSkeleton />;
    }

    if (savedFiltersQuery.isError) {
      return (
        <p className="text-muted-foreground px-2 py-1.5">
          {m.budget_saved_filters_error()}
        </p>
      );
    }

    if (savedFilters.length === 0) {
      return (
        <p className="text-muted-foreground px-2 py-1.5">
          {m.budget_saved_filters_empty()}
        </p>
      );
    }

    return (
      <ul className="flex max-h-56 flex-col overflow-y-auto overscroll-contain">
        {savedFilters.map((saved) => {
          const isApplied =
            searchKey(saved.filters, saved.search) === currentKey;

          return (
            <li className="flex items-center gap-0.5" key={saved.id}>
              <button
                aria-current={isApplied ? "true" : undefined}
                className="hover:bg-hover flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1 text-left leading-snug outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                onClick={() => applySaved(saved)}
                type="button"
              >
                <span className="flex max-w-full items-center gap-1 font-medium">
                  <span className="min-w-0 break-words">{saved.name}</span>
                  {isApplied && (
                    <>
                      <RiCheckLine
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                      <span className="sr-only">
                        {m.budget_saved_filter_applied()}
                      </span>
                    </>
                  )}
                </span>
                <span className="text-muted-foreground max-w-full text-[11px] break-words">
                  {summaryOf(saved)}
                </span>
              </button>
              <Button
                loading={deletingId === saved.id}
                onClick={() => deleteSavedFilter(saved)}
                size="icon-compact"
                variant="ghost"
              >
                <RiDeleteBinLine aria-hidden="true" />
                <span className="sr-only">
                  {m.budget_saved_filter_delete({ name: saved.name })}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  const saveFormOf = () => {
    if (!hasSomethingToSave) {
      return (
        <p className="text-muted-foreground px-2 py-1.5 text-[11px]">
          {m.budget_saved_filter_save_hint_empty()}
        </p>
      );
    }

    return (
      <form className="flex flex-col gap-1 px-1 pt-1" onSubmit={handleSave}>
        <label
          className="text-muted-foreground px-1 text-[11px] font-medium"
          htmlFor={nameId}
        >
          {m.budget_saved_filter_save_as()}
        </label>
        <div className="flex items-center gap-1">
          <Input
            aria-describedby={replaced ? hintId : undefined}
            className="min-w-0 flex-1"
            id={nameId}
            maxLength={MAX_SAVED_FILTER_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.budget_saved_filter_name_placeholder()}
            value={name}
          />
          <Button
            disabled={trimmedName === ""}
            loading={isSaving}
            size="compact"
            type="submit"
            variant="secondary"
          >
            {m.budget_saved_filter_save_button()}
          </Button>
        </div>
        {replaced && (
          <p className="text-muted-foreground px-1 text-[11px]" id={hintId}>
            {m.budget_saved_filter_save_hint_replace({ name: replaced.name })}
          </p>
        )}
      </form>
    );
  };

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger
        render={
          <Button leadingIcon={remixIcon(RiBookmarkLine)} variant="tertiary" />
        }
      >
        {m.budget_saved_filters()}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={m.budget_saved_filters()}
        className="gap-1 p-1"
      >
        {listOf()}
        <div className="border-border border-t">{saveFormOf()}</div>
      </PopoverContent>
    </Popover>
  );
};
