import { CATEGORY_GROUPS, categoriesInGroup } from "@freenary/api/lib/taxonomy";
import {
  AMOUNT_FILTER_OPERATORS,
  LIST_FILTER_OPERATORS,
  MAX_FILTER_AMOUNT_MINOR_UNITS,
  MAX_TRANSACTION_FILTERS,
  TRANSACTION_FILTER_FIELDS,
} from "@freenary/api/lib/transaction-filters";
import type {
  AmountFilterOperator,
  CategoryFilterValue,
  ListFilterOperator,
  TransactionFilter,
  TransactionFilterField,
} from "@freenary/api/lib/transaction-filters";

import { categoryRowMatches } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { foldForSearch } from "@/shared/lib/search-text";

import type {
  AmountDraft,
  CategoryDraft,
  CompanyDraft,
  FilterDraft,
} from "./filter-draft";
import {
  AMOUNT_OPERATOR_LABELS,
  AMOUNT_OPERATOR_SYMBOLS,
  canAddFilter,
  categoryValueLabel,
  FILTER_FIELD_LABELS,
  LIST_OPERATOR_LABELS,
} from "./filter-tokens";

export type FilterSuggestion =
  | { field: TransactionFilterField; kind: "field"; label: string }
  | {
      kind: "operator";
      label: string;
      operator: AmountFilterOperator | ListFilterOperator;
      symbol: string | null;
    }
  | { kind: "company"; label: string; name: string; picked: boolean }
  | {
      isGroup: boolean;
      kind: "category";
      label: string;
      picked: boolean;
      value: CategoryFilterValue;
    }
  | { kind: "amount"; label: string; minorUnits: number };

const LAST_WORD = /\S+$/u;

export const lastWordOf = (text: string): string =>
  LAST_WORD.exec(text)?.[0] ?? "";

export const withoutLastWord = (text: string): string =>
  text.replace(LAST_WORD, "").trimEnd();

const startsWithFolded = (label: string, query: string) =>
  foldForSearch(label).startsWith(foldForSearch(query.trim()));

export const fieldSuggestions = (fragment: string): FilterSuggestion[] =>
  TRANSACTION_FILTER_FIELDS.flatMap((field) => {
    const label = FILTER_FIELD_LABELS[field]();

    return startsWithFolded(label, fragment)
      ? [{ field, kind: "field" as const, label }]
      : [];
  });

interface OperatorChoice {
  label: string;
  operator: AmountFilterOperator | ListFilterOperator;
  symbol: string | null;
}

const operatorChoices = (field: TransactionFilterField): OperatorChoice[] =>
  field === "amount"
    ? AMOUNT_FILTER_OPERATORS.map((operator) => ({
        label: AMOUNT_OPERATOR_LABELS[operator](),
        operator,
        symbol: AMOUNT_OPERATOR_SYMBOLS[operator](),
      }))
    : LIST_FILTER_OPERATORS.map((operator) => ({
        label: LIST_OPERATOR_LABELS[operator](),
        operator,
        symbol: null,
      }));

export const operatorSuggestions = (
  field: TransactionFilterField,
  query: string
): FilterSuggestion[] =>
  operatorChoices(field).flatMap((choice) =>
    startsWithFolded(choice.label, query) || choice.symbol === query.trim()
      ? [{ kind: "operator" as const, ...choice }]
      : []
  );

export const categorySuggestions = (
  draft: CategoryDraft,
  query: string
): FilterSuggestion[] =>
  CATEGORY_GROUPS.flatMap((group) => {
    const groupLabel = categoryValueLabel(group);
    const values: CategoryFilterValue[] = [group, ...categoriesInGroup(group)];

    return values.flatMap((value) => {
      const label = categoryValueLabel(value);
      const matches = categoryRowMatches(
        { group: groupLabel, label, value },
        query
      );

      return matches
        ? [
            {
              isGroup: value === group,
              kind: "category" as const,
              label,
              picked: draft.values.includes(value),
              value,
            },
          ]
        : [];
    });
  });

export const companySuggestions = (
  draft: CompanyDraft,
  found: readonly string[],
  query: string
): FilterSuggestion[] => {
  const listed = new Set(found.map(foldForSearch));
  const needle = foldForSearch(query.trim());
  const pickedElsewhere = draft.values.filter(
    (name) =>
      !listed.has(foldForSearch(name)) && foldForSearch(name).includes(needle)
  );

  return [...pickedElsewhere, ...found].map((name) => ({
    kind: "company" as const,
    label: name,
    name,
    picked: draft.values.some(
      (picked) => foldForSearch(picked) === foldForSearch(name)
    ),
  }));
};

const amountSuggestion = (
  draft: AmountDraft,
  minorUnits: number,
  currency: string
): FilterSuggestion[] =>
  minorUnits > 0 && minorUnits <= MAX_FILTER_AMOUNT_MINOR_UNITS
    ? [
        {
          kind: "amount",
          label: `${AMOUNT_OPERATOR_SYMBOLS[draft.operator]()} ${formatCurrency(minorUnits, currency)}`,
          minorUnits,
        },
      ]
    : [];

export interface SuggestionContext {
  companies: {
    isError: boolean;
    isPending: boolean;
    names: readonly string[];
    query: string;
  };
  currency: string;
  draft: FilterDraft | null;
  filters: readonly TransactionFilter[];
  query: string;
  text: string;
  typedAmountMinor: number;
}

export const filterSuggestionsFor = ({
  companies,
  currency,
  draft,
  filters,
  query,
  text,
  typedAmountMinor,
}: SuggestionContext): FilterSuggestion[] => {
  if (draft === null) {
    return canAddFilter(filters) ? fieldSuggestions(lastWordOf(text)) : [];
  }

  if (draft.stage === "operator") {
    return operatorSuggestions(draft.field, query);
  }

  if (draft.stage === "amount") {
    return amountSuggestion(draft, typedAmountMinor, currency);
  }

  return draft.field === "category"
    ? categorySuggestions(draft, query)
    : companySuggestions(draft, companies.names, companies.query);
};

const companyStatus = ({
  isError,
  isPending,
}: SuggestionContext["companies"]) => {
  if (isPending) {
    return m.budget_merchant_loading();
  }

  return isError ? m.budget_merchant_error() : m.budget_merchant_search_empty();
};

export const filterSuggestionStatus = (
  { companies, currency, draft, filters, typedAmountMinor }: SuggestionContext,
  suggestions: readonly FilterSuggestion[]
): string | null => {
  if (draft === null) {
    return canAddFilter(filters)
      ? null
      : m.budget_filter_limit({ count: MAX_TRANSACTION_FILTERS });
  }

  if (draft.stage === "amount") {
    if (typedAmountMinor > MAX_FILTER_AMOUNT_MINOR_UNITS) {
      return m.budget_filter_amount_too_large({
        amount: formatCurrency(MAX_FILTER_AMOUNT_MINOR_UNITS, currency),
      });
    }

    return typedAmountMinor > 0 ? null : m.budget_filter_amount_prompt();
  }

  if (draft.stage === "operator" || suggestions.length > 0) {
    return null;
  }

  return draft.field === "category"
    ? m.budget_category_search_empty()
    : companyStatus(companies);
};

export const highlightsByDefault = (
  draft: FilterDraft | null,
  query: string
): boolean => {
  if (draft === null) {
    return false;
  }

  const waitsForEnterToApply =
    draft.stage === "values" &&
    draft.operator === "isAnyOf" &&
    draft.values.length > 0 &&
    query.trim() === "";

  return !waitsForEnterToApply;
};
