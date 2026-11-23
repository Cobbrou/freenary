import {
  categoryGroupAppearance,
  predefinedCategoryAppearance,
} from "@freenary/api/lib/categories";
import { isCategoryGroup } from "@freenary/api/lib/taxonomy";
import { MAX_SEARCH_TEXT_LENGTH } from "@freenary/api/lib/transaction-filters";
import type { CategoryFilterValue } from "@freenary/api/lib/transaction-filters";
import { Button } from "@freenary/ui/components/button";
import { cn } from "@freenary/ui/lib/utils";
import { RiBankLine, RiCheckLine, RiSearchLine } from "@remixicon/react";
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
  chipValue,
  FILTER_FIELD_LABELS,
  filterChipValue,
  filterTokenSentence,
  filterTokenText,
  filterValueList,
  LIST_OPERATOR_LABELS,
} from "../model/filter-tokens";
import type { AccountNameOf } from "../model/filter-tokens";
import {
  filterKey,
  useFilterTokenSearch,
} from "../model/use-filter-token-search";
import type { FilterTokenSearchOptions } from "../model/use-filter-token-search";
import { FilterTokenChip } from "./filter-token-chip";

const suggestionKey = (suggestion: FilterSuggestion): string =>
  Match.value(suggestion).pipe(
    Match.discriminatorsExhaustive("kind")({
      account: ({ accountId }) => `account:${accountId}`,
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
  (suggestion.kind === "company" ||
    suggestion.kind === "category" ||
    suggestion.kind === "account") &&
  suggestion.picked;

const SuggestionContent = ({
  suggestion,
}: {
  suggestion: FilterSuggestion;
}): ReactNode =>
  Match.value(suggestion).pipe(
    Match.discriminatorsExhaustive("kind")({
      account: ({ label }) => (
        <span className="flex min-w-0 items-center gap-2">
          <RiBankLine
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <span className="truncate">{label}</span>
        </span>
      ),
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

const draftValueLabels = (
  draft: Extract<FilterDraft, { stage: "values" }>,
  accountName: AccountNameOf
): string[] => {
  if (draft.field === "category") {
    return draft.values.map(categoryValueLabel);
  }

  return draft.field === "account"
    ? draft.values.map(accountName)
    : draft.values;
};

const draftChipText = (
  draft: FilterDraft,
  locale: string,
  accountName: AccountNameOf
): { field: string; value?: string } => {
  const field = FILTER_FIELD_LABELS[draft.field]();

  if (draft.stage === "operator") {
    return { field };
  }

  if (draft.stage === "amount") {
    return { field, value: AMOUNT_OPERATOR_SYMBOLS[draft.operator]() };
  }

  const labels = draftValueLabels(draft, accountName);

  return {
    field,
    value: chipValue(draft.operator, {
      operator: LIST_OPERATOR_LABELS[draft.operator](),
      value: labels.length > 0 ? filterValueList(labels, locale) : "",
    }),
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
  const { accounts, currency, filters } = options;
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
    handleFocus,
    handleHighlight,
    handleKeyDown,
    handleRemove,
    inputRef,
    inputValue,
    isChoosingSeveral,
    isPopupShown,
    status,
    suggestions,
    text,
  } = useFilterTokenSearch(options);

  const accountName: AccountNameOf = (accountId) =>
    accounts.find((account) => account.id === accountId)?.label ??
    m.budget_filter_account_unknown();

  const optionId = (index: number) => `${listId}-option-${index}`;
  const pendingChip =
    draft === null ? null : draftChipText(draft, locale, accountName);

  const activeOptionId =
    isPopupShown && active >= 0 ? optionId(active) : undefined;

  const isEmpty = filters.length === 0 && draft === null;

  return (
    <div className="relative w-full" onBlur={handleBlur}>
      <div
        className="bg-surface-3 shadow-surface-2 focus-within:ring-ring/50 flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl py-1.5 ps-2.5 pe-1.5 transition-shadow focus-within:ring-[3px]"
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        <RiSearchLine
          aria-hidden="true"
          className="text-foreground size-4 shrink-0"
        />
        {filters.map((filter, index) => {
          const chip = filterTokenText(filter, locale, currency, accountName);

          return (
            <FilterTokenChip
              field={chip.field}
              key={filterKey(filter)}
              onRemove={() => handleRemove(index)}
              removeLabel={m.budget_filter_token_remove({
                filter: filterTokenSentence(
                  filter,
                  locale,
                  currency,
                  accountName
                ),
              })}
              value={filterChipValue(filter, chip)}
            />
          );
        })}
        {pendingChip && (
          <>
            {text && <span className="text-sm">{text}</span>}
            <FilterTokenChip
              field={pendingChip.field}
              id={pendingId}
              isPending
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
          className="placeholder:text-muted-foreground h-7 min-w-40 flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={
            isEmpty
              ? m.budget_filter_search_placeholder_empty()
              : m.budget_filter_search_placeholder_more()
          }
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={inputValue}
        />
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
