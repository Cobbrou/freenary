import { isCategoryGroup } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { MAX_TRANSACTION_FILTERS } from "@freenary/api/lib/transaction-filters";
import type {
  AmountFilterOperator,
  CategoryFilterValue,
  ListFilterOperator,
  TransactionFilter,
  TransactionFilterField,
} from "@freenary/api/lib/transaction-filters";

import { categoryGroupLabel, categoryLabel } from "@/entities/category";
import type { CategorySelection } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

export const FILTER_FIELD_LABELS = {
  amount: m.budget_filter_field_amount,
  category: m.budget_filter_field_category,
  company: m.budget_filter_field_company,
} satisfies Record<TransactionFilterField, () => string>;

export const LIST_OPERATOR_LABELS = {
  is: m.budget_filter_operator_is,
  isAnyOf: m.budget_filter_operator_is_any_of,
  isNot: m.budget_filter_operator_is_not,
} satisfies Record<ListFilterOperator, () => string>;

export const AMOUNT_OPERATOR_SYMBOLS = {
  eq: m.budget_filter_operator_eq_symbol,
  gt: m.budget_filter_operator_gt_symbol,
  lt: m.budget_filter_operator_lt_symbol,
} satisfies Record<AmountFilterOperator, () => string>;

export const AMOUNT_OPERATOR_LABELS = {
  eq: m.budget_filter_operator_eq,
  gt: m.budget_filter_operator_gt,
  lt: m.budget_filter_operator_lt,
} satisfies Record<AmountFilterOperator, () => string>;

export const categoryValueLabel = (value: CategoryFilterValue): string =>
  isCategoryGroup(value) ? categoryGroupLabel(value) : categoryLabel(value);

export interface FilterTokenText {
  field: string;
  operator: string;
  value: string;
}

export const filterValueList = (
  labels: readonly string[],
  locale: string
): string =>
  new Intl.ListFormat(locale, { type: "disjunction" }).format(labels);

export const filterTokenText = (
  filter: TransactionFilter,
  locale: string,
  currency: string
): FilterTokenText => {
  if (filter.field === "amount") {
    return {
      field: FILTER_FIELD_LABELS.amount(),
      operator: AMOUNT_OPERATOR_SYMBOLS[filter.operator](),
      value: formatCurrency(filter.value, currency),
    };
  }

  const labels =
    filter.field === "category"
      ? filter.values.map(categoryValueLabel)
      : filter.values;

  return {
    field: FILTER_FIELD_LABELS[filter.field](),
    operator: LIST_OPERATOR_LABELS[filter.operator](),
    value: filterValueList(labels, locale),
  };
};

export const filterTokenSentence = (
  filter: TransactionFilter,
  locale: string,
  currency: string
): string => {
  const { field, value } = filterTokenText(filter, locale, currency);
  const operator =
    filter.field === "amount"
      ? AMOUNT_OPERATOR_LABELS[filter.operator]()
      : LIST_OPERATOR_LABELS[filter.operator]();

  return m.budget_filter_token_sentence({ field, operator, value });
};

export const canAddFilter = (filters: readonly TransactionFilter[]) =>
  filters.length < MAX_TRANSACTION_FILTERS;

export const withoutFilterAt = (
  filters: readonly TransactionFilter[],
  index: number
): TransactionFilter[] =>
  filters.filter((_filter, position) => position !== index);

const isInclusiveCategoryFilter = (
  filter: TransactionFilter
): filter is Extract<TransactionFilter, { field: "category" }> =>
  filter.field === "category" && filter.operator !== "isNot";

export const highlightedChartCategories = (
  filters: readonly TransactionFilter[]
): SpendingCategory[] =>
  filters.flatMap((filter) =>
    isInclusiveCategoryFilter(filter)
      ? filter.values.flatMap((value) =>
          isCategoryGroup(value) ? [] : [value]
        )
      : []
  );

const selectionValues = (
  selection: CategorySelection
): CategoryFilterValue[] => {
  if (selection.kind === "categories") {
    return selection.categories;
  }

  return [selection.kind === "group" ? selection.group : selection.category];
};

const sameValues = (
  left: readonly CategoryFilterValue[],
  right: readonly CategoryFilterValue[]
) =>
  left.length === right.length && left.every((value) => right.includes(value));

export const selectChartCategory = (
  filters: readonly TransactionFilter[],
  selection: CategorySelection | null
): TransactionFilter[] => {
  const withoutCategories = filters.filter(
    (filter) => filter.field !== "category"
  );

  if (selection === null) {
    return withoutCategories;
  }

  const picked = selectionValues(selection);
  const categoryFilters = filters.filter(
    (filter) => filter.field === "category"
  );

  const [onlyCategoryFilter] = categoryFilters;
  const isAlreadyTheOnlyOne =
    categoryFilters.length === 1 &&
    onlyCategoryFilter !== undefined &&
    isInclusiveCategoryFilter(onlyCategoryFilter) &&
    sameValues(onlyCategoryFilter.values, picked);

  return isAlreadyTheOnlyOne
    ? withoutCategories
    : [
        ...withoutCategories,
        {
          field: "category",
          operator: picked.length > 1 ? "isAnyOf" : "is",
          values: picked,
        },
      ];
};

const canonicalFilter = (filter: TransactionFilter) =>
  filter.field === "amount"
    ? filter
    : { ...filter, values: [...filter.values].toSorted() };

export const searchKey = (
  filters: readonly TransactionFilter[],
  search: string
): string =>
  JSON.stringify({
    filters: filters
      .map((filter) => JSON.stringify(canonicalFilter(filter)))
      .toSorted(),
    search: search.trim(),
  });
