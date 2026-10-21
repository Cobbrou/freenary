import {
  categoryGroupAppearance,
  predefinedCategoryAppearance,
} from "@freenary/api/lib/categories";
import { isCategoryGroup } from "@freenary/api/lib/taxonomy";
import { MAX_SEARCH_TEXT_LENGTH } from "@freenary/api/lib/transaction-filters";
import type { CategoryFilterValue } from "@freenary/api/lib/transaction-filters";
import { Button } from "@freenary/ui/components/button";
import { cn } from "@freenary/ui/lib/utils";
import { RiCheckLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import { Match } from "effect";
import { useId } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { CategoryIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import type { FilterDraft } from "../model/filter-draft";
import type { FilterSuggestion } from "../model/filter-suggestions";
import {
  AMOUNT_OPERATOR_SYMBOLS,
  categoryValueLabel,
  FILTER_FIELD_LABELS,
  filterTokenSentence,
  filterTokenText,
  filterValueList,
  LIST_OPERATOR_LABELS,
} from "../model/filter-tokens";
import {
  filterKey,
  useFilterTokenSearch,
} from "../model/use-filter-token-search";
import type { FilterTokenSearchOptions } from "../model/use-filter-token-search";
import { FilterTokenChip } from "./filter-token-chip";

const suggestionKey = (suggestion: FilterSuggestion): string =>
  Match.value(suggestion).pipe(
    Match.discriminatorsExhaustive("kind")({
      amount: ({ minorUnits }) => `amount:${minorUnits}`,
      category: ({ value }) => `category:${value}`,
      company: ({ name }) => `company:${name}`,
      field: ({ field }) => `field:${field}`,
      operator: ({ operator }) => `operator:${operator}`,
    })
  );

const categoryAppearanceOf = (value: CategoryFilterValue) =>
  isCategoryGroup(value)
    ? categoryGroupAppearance(value)
    : predefinedCategoryAppearance(value);

const isPicked = (suggestion: FilterSuggestion) =>
  (suggestion.kind === "company" || suggestion.kind === "category") &&
  suggestion.picked;

const SuggestionContent = ({
  suggestion,
}: {
  suggestion: FilterSuggestion;
}): ReactNode =>
  Match.value(suggestion).pipe(
    Match.discriminatorsExhaustive("kind")({
      amount: ({ label }) => <span className="tabular-nums">{label}</span>,
      category: ({ isGroup, label, value }) => (
        <span className={cn("flex items-center gap-2", !isGroup && "ps-3")}>
          <CategoryIcon
            {...categoryAppearanceOf(value)}
            className="size-5 [&_svg]:size-3"
          />
          <span className={cn(isGroup && "font-medium")}>{label}</span>
        </span>
      ),
      company: ({ label }) => <span className="truncate">{label}</span>,
      field: ({ label }) => <span className="font-medium">{label}</span>,
      operator: ({ label, symbol }) => (
        <span className="flex items-center gap-2">
          {symbol && (
            <span aria-hidden="true" className="w-3 font-medium tabular-nums">
              {symbol}
            </span>
          )}
          {label}
        </span>
      ),
    })
  );

const draftChipText = (draft: FilterDraft, locale: string) => {
  const field = FILTER_FIELD_LABELS[draft.field]();

  if (draft.stage === "operator") {
    return { field };
  }

  if (draft.stage === "amount") {
    return { field, operator: AMOUNT_OPERATOR_SYMBOLS[draft.operator]() };
  }

  const labels =
    draft.field === "category"
      ? draft.values.map(categoryValueLabel)
      : draft.values;

  return {
    field,
    operator: LIST_OPERATOR_LABELS[draft.operator](),
    value: labels.length > 0 ? filterValueList(labels, locale) : undefined,
  };
};

interface SuggestionPopupProps {
  active: number;
  canApply: boolean;
  isChoosingSeveral: boolean;
  listId: string;
  onApply: () => void;
  onChoose: (suggestion: FilterSuggestion) => void;
  onHighlight: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  optionId: (index: number) => string;
  status: string | null;
  suggestions: FilterSuggestion[];
}

const SuggestionPopup = ({
  active,
  canApply,
  isChoosingSeveral,
  listId,
  onApply,
  onChoose,
  onHighlight,
  onKeyDown,
  optionId,
  status,
  suggestions,
}: SuggestionPopupProps) => (
  <div
    className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full left-0 z-50 mt-1 flex w-80 max-w-full flex-col gap-1 rounded-lg p-1 text-xs shadow-md ring-1"
    onMouseDown={(event) => event.preventDefault()}
    role="presentation"
  >
    {status && (
      <output className="text-muted-foreground px-2 py-1.5">{status}</output>
    )}
    <div
      aria-label={m.budget_filter_search_label()}
      aria-multiselectable={isChoosingSeveral || undefined}
      className="max-h-72 overflow-y-auto"
      id={listId}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the rows carry icons and checkmarks, which neither <select> nor <datalist> can render, and the search input drives them through aria-activedescendant.
      role="listbox"
    >
      {suggestions.map((suggestion, index) => (
        <div
          aria-selected={
            isChoosingSeveral ? isPicked(suggestion) : index === active
          }
          className={cn(
            "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5",
            index === active && "bg-hover"
          )}
          id={optionId(index)}
          key={suggestionKey(suggestion)}
          onClick={() => onChoose(suggestion)}
          onKeyDown={onKeyDown}
          onMouseMove={() => onHighlight(index)}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <option> renders only text, and only inside a <select> or a <datalist>.
          role="option"
          tabIndex={-1}
        >
          <SuggestionContent suggestion={suggestion} />
          {isPicked(suggestion) && (
            <RiCheckLine aria-hidden="true" className="size-3.5" />
          )}
        </div>
      ))}
    </div>
    {isChoosingSeveral && (
      <div className="border-border flex items-center justify-between gap-2 border-t px-2 pt-1.5 pb-0.5">
        <span className="text-muted-foreground">
          {m.budget_filter_values_hint()}
        </span>
        <Button
          disabled={!canApply}
          onClick={onApply}
          size="compact"
          variant="secondary"
        >
          {m.budget_filter_values_apply()}
        </Button>
      </div>
    )}
  </div>
);

export const FilterTokenSearch = (options: FilterTokenSearchOptions) => {
  const { filters } = options;
  const locale = getLocale();
  const listId = useId();
  const pendingId = useId();
  const {
    active,
    draft,
    handleApply,
    handleBlur,
    handleChange,
    handleChoose,
    handleClear,
    handleFocus,
    handleHighlight,
    handleKeyDown,
    handleRemove,
    hasAnything,
    inputRef,
    inputValue,
    isChoosingSeveral,
    isPopupShown,
    status,
    suggestions,
    text,
  } = useFilterTokenSearch(options);

  const optionId = (index: number) => `${listId}-option-${index}`;
  const pendingChip = draft === null ? null : draftChipText(draft, locale);

  const activeOptionId =
    isPopupShown && active >= 0 ? optionId(active) : undefined;

  const isEmpty = filters.length === 0 && draft === null;

  return (
    <div className="relative min-w-60 flex-1" onBlur={handleBlur}>
      <div
        className="border-input bg-input/20 dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/30 flex min-h-7 w-full cursor-text flex-wrap items-center gap-1 rounded-md border px-2 py-px transition-colors focus-within:ring-2"
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        <RiSearchLine
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0"
        />
        {filters.map((filter, index) => {
          const chip = filterTokenText(filter, locale);

          return (
            <FilterTokenChip
              field={chip.field}
              key={filterKey(filter)}
              onRemove={() => handleRemove(index)}
              operator={chip.operator}
              removeLabel={m.budget_filter_token_remove({
                filter: filterTokenSentence(filter, locale),
              })}
              value={chip.value}
            />
          );
        })}
        {pendingChip && (
          <>
            {text && <span className="text-xs">{text}</span>}
            <FilterTokenChip
              field={pendingChip.field}
              id={pendingId}
              isPending
              operator={pendingChip.operator}
              value={pendingChip.value}
            />
          </>
        )}
        <input
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-describedby={pendingChip ? pendingId : undefined}
          aria-controls={isPopupShown ? listId : undefined}
          aria-expanded={isPopupShown}
          aria-label={m.budget_filter_search_label()}
          autoComplete="off"
          maxLength={MAX_SEARCH_TEXT_LENGTH}
          className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent text-xs outline-none"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={
            isEmpty ? m.budget_filter_search_placeholder() : undefined
          }
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={inputValue}
        />
        {hasAnything && (
          <button
            aria-label={m.budget_filter_clear_search()}
            className="text-muted-foreground hover:text-foreground hover:bg-hover flex size-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
            onClick={handleClear}
            type="button"
          >
            <RiCloseLine aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {isPopupShown && (
        <SuggestionPopup
          active={active}
          canApply={draft?.stage === "values" && draft.values.length > 0}
          isChoosingSeveral={isChoosingSeveral}
          listId={listId}
          onApply={handleApply}
          onChoose={handleChoose}
          onHighlight={handleHighlight}
          onKeyDown={handleKeyDown}
          optionId={optionId}
          status={status}
          suggestions={suggestions}
        />
      )}
    </div>
  );
};
