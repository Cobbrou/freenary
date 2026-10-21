import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Match } from "effect";
import { useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import { getLocale } from "@/paraglide/runtime.js";
import { orpc } from "@/shared/api";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

import { useSettledText } from "../lib/use-settled-text";
import {
  appliedAmount,
  appliedValues,
  draftForField,
  isReadyToApply,
  stepBack,
  withCategory,
  withCompany,
  withOperator,
} from "./filter-draft";
import type { FilterDraft } from "./filter-draft";
import {
  filterSuggestionsFor,
  filterSuggestionStatus,
  highlightsByDefault,
  lastWordOf,
  withoutLastWord,
} from "./filter-suggestions";
import type { FilterSuggestion } from "./filter-suggestions";
import { searchKey, withoutFilterAt } from "./filter-tokens";
import type { TransactionDirection } from "./search";
import { parseAmountBound } from "./transaction-filters";

export interface FilterTokenSearchOptions {
  direction: TransactionDirection;
  filters: TransactionFilter[];
  from: Date;
  onClear: () => void;
  onFiltersChange: (filters: TransactionFilter[]) => void;
  onSearchChange: (search: string) => void;
  search: string;
  to: Date;
}

const COMPANY_SETTLE_MS = 250;
const MINOR_PER_UNIT = 100;
export const NO_HIGHLIGHT = -1;

export const filterKey = (filter: TransactionFilter) => searchKey([filter], "");

export const useFilterTokenSearch = ({
  direction,
  filters,
  from,
  onClear,
  onFiltersChange,
  onSearchChange,
  search,
  to,
}: FilterTokenSearchOptions) => {
  const locale = getLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const { draft: text, setDraft: setText } = useSettledText(
    search,
    onSearchChange
  );

  const [draft, setDraft] = useState<FilterDraft | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const settledCompanyQuery = useDebouncedValue(query, COMPANY_SETTLE_MS);

  const merchantsQuery = useQuery({
    ...orpc.budget.getMerchants.queryOptions({
      input: {
        direction,
        from,
        search: settledCompanyQuery.trim() || undefined,
        to,
      },
    }),
    enabled: draft?.stage === "values" && draft.field === "company",
    placeholderData: keepPreviousData,
  });

  const typedAmountMinor = Math.round(
    parseAmountBound(query, locale) * MINOR_PER_UNIT
  );

  const companies = {
    isError: merchantsQuery.isError,
    isPending: merchantsQuery.isPending,
    names: (merchantsQuery.data?.merchants ?? []).map(
      (merchant) => merchant.name
    ),
    query: settledCompanyQuery,
  };

  const context = { companies, draft, filters, query, text, typedAmountMinor };
  const suggestions = filterSuggestionsFor(context);
  const status = filterSuggestionStatus(context, suggestions);
  const isChoosingSeveral =
    draft?.stage === "values" && draft.operator === "isAnyOf";

  const isPopupShown =
    isOpen && (suggestions.length > 0 || status !== null || isChoosingSeveral);

  const defaultIndex =
    highlightsByDefault(draft, query) && suggestions.length > 0
      ? 0
      : NO_HIGHLIGHT;

  const active =
    highlight === null
      ? defaultIndex
      : Math.min(highlight, suggestions.length - 1);

  const inputValue = draft === null ? text : query;

  const enterStage = (next: FilterDraft | null) => {
    setDraft(next);
    setQuery("");
    setHighlight(null);
    setIsOpen(true);
  };

  const apply = (filter: TransactionFilter | null) => {
    const isNew =
      filter !== null &&
      filters.every((kept) => filterKey(kept) !== filterKey(filter));

    if (filter !== null && isNew) {
      onFiltersChange([...filters, filter]);
    }

    enterStage(null);
  };

  const applyPendingValues = () => {
    if (draft?.stage === "values") {
      apply(appliedValues(draft));
    }
  };

  const choose = (suggestion: FilterSuggestion) =>
    Match.value(suggestion).pipe(
      Match.discriminatorsExhaustive("kind")({
        amount: ({ minorUnits }) => {
          if (draft?.stage === "amount") {
            apply(appliedAmount(draft, minorUnits));
          }
        },
        category: ({ value }) => {
          if (draft?.stage !== "values" || draft.field !== "category") {
            return;
          }

          const next = withCategory(draft, value);

          if (isReadyToApply(next)) {
            apply(appliedValues(next));
          } else {
            enterStage(next);
          }
        },
        company: ({ name }) => {
          if (draft?.stage !== "values" || draft.field !== "company") {
            return;
          }

          const next = withCompany(draft, name);

          if (isReadyToApply(next)) {
            apply(appliedValues(next));
          } else {
            enterStage(next);
          }
        },
        field: ({ field }) => {
          if (lastWordOf(text) !== "") {
            setText(withoutLastWord(text));
          }

          enterStage(draftForField(field));
        },
        operator: ({ operator }) => {
          if (draft?.stage === "operator") {
            enterStage(withOperator(draft, operator));
          }
        },
      })
    );

  const moveHighlight = (step: number) => {
    setIsOpen(true);

    const count = suggestions.length;

    if (count === 0) {
      return;
    }

    const fromNothing = step > 0 ? 0 : count - 1;

    setHighlight(
      active === NO_HIGHLIGHT ? fromNothing : (active + step + count) % count
    );
  };

  const confirm = () => {
    const chosen = isPopupShown ? suggestions[active] : undefined;

    if (chosen) {
      choose(chosen);

      return;
    }

    if (draft?.stage === "values") {
      applyPendingValues();

      return;
    }

    setIsOpen(false);
  };

  const dismiss = (): boolean => {
    const wasBusy = isOpen || draft !== null;

    setDraft(null);
    setQuery("");
    setIsOpen(false);

    return wasBusy;
  };

  const stepBackFromEmptyInput = (): boolean => {
    if (inputValue !== "") {
      return false;
    }

    if (draft !== null) {
      enterStage(stepBack(draft));

      return true;
    }

    if (filters.length === 0) {
      return false;
    }

    onFiltersChange(withoutFilterAt(filters, filters.length - 1));

    return true;
  };

  const keyActions: Record<string, () => boolean> = {
    ArrowDown: () => {
      moveHighlight(1);

      return true;
    },
    ArrowUp: () => {
      moveHighlight(-1);

      return true;
    },
    Backspace: stepBackFromEmptyInput,
    Enter: () => {
      confirm();

      return true;
    },
    Escape: dismiss,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const handled = keyActions[event.key]?.() ?? false;

    if (handled) {
      event.preventDefault();
    }
  };

  const handleChange = (value: string) => {
    if (draft === null) {
      setText(value);
    } else {
      setQuery(value);
    }

    setHighlight(null);
    setIsOpen(true);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    if (draft?.stage === "values" && draft.values.length > 0) {
      applyPendingValues();
    } else {
      setDraft(null);
      setQuery("");
    }

    setIsOpen(false);
  };

  const clearEverything = () => {
    setText("");
    enterStage(null);
    onClear();
    inputRef.current?.focus();
  };

  const removeFilterAt = (index: number) => {
    onFiltersChange(withoutFilterAt(filters, index));
    inputRef.current?.focus();
  };

  return {
    active,
    draft,
    handleApply: applyPendingValues,
    handleBlur,
    handleChange,
    handleChoose: choose,
    handleClear: clearEverything,
    handleFocus: () => setIsOpen(true),
    handleHighlight: setHighlight,
    handleKeyDown,
    handleRemove: removeFilterAt,
    hasAnything: filters.length > 0 || text !== "" || draft !== null,
    inputRef,
    inputValue,
    isChoosingSeveral,
    isPopupShown,
    status,
    suggestions,
    text,
  };
};
