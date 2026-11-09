import { fromMinor } from "@freenary/api/lib/money";
import { categoriesInGroup } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import { EMPTY_CATEGORY_FILTER, filterCount } from "@/entities/category";
import type { CategoryFilter } from "@/entities/category";
import { foldForSearch } from "@/shared/lib/search-text";

import {
  merchantLabel,
  monthlyEquivalentMinor,
  recurringSections,
} from "./recurring";
import type {
  RecurrenceConfidence,
  RecurrenceFrequency,
  RecurringItem,
  RecurringSection,
} from "./recurring";
import type { RecurringSortMode } from "./search";
import { EMPTY_AMOUNT_RANGE } from "./transaction-filters";
import type { AmountRange } from "./transaction-filters";

export interface RecurringFilter {
  amount: AmountRange;
  categories: CategoryFilter;
  confidences: RecurrenceConfidence[];
  frequencies: RecurrenceFrequency[];
  search: string;
}

export interface RecurringGroups {
  behavioral: RecurringSection;
  fixed: RecurringSection;
}

export const EMPTY_RECURRING_FILTER: RecurringFilter = {
  amount: EMPTY_AMOUNT_RANGE,
  categories: EMPTY_CATEGORY_FILTER,
  confidences: [],
  frequencies: [],
  search: "",
};

const AMOUNT_RANGE_COUNTS_ONCE = 1;
const NO_AMOUNT_BOUND = 0;

export const recurringFilterCount = (filter: RecurringFilter): number =>
  filterCount(filter.categories) +
  filter.frequencies.length +
  filter.confidences.length +
  (filter.amount.min > NO_AMOUNT_BOUND || filter.amount.max > NO_AMOUNT_BOUND
    ? AMOUNT_RANGE_COUNTS_ONCE
    : 0);

export const toggleFrequency = (
  frequencies: RecurrenceFrequency[],
  value: RecurrenceFrequency
): RecurrenceFrequency[] =>
  frequencies.includes(value)
    ? frequencies.filter((entry) => entry !== value)
    : [...frequencies, value];

export const toggleConfidence = (
  confidences: RecurrenceConfidence[],
  value: RecurrenceConfidence
): RecurrenceConfidence[] =>
  confidences.includes(value)
    ? confidences.filter((entry) => entry !== value)
    : [...confidences, value];

const categoriesUnionedWithGroups = (
  filter: CategoryFilter
): Set<SpendingCategory> | null => {
  if (filter.categories.length === 0 && filter.groups.length === 0) {
    return null;
  }

  const allowed = new Set<SpendingCategory>(filter.categories);

  for (const group of filter.groups) {
    for (const category of categoriesInGroup(group)) {
      allowed.add(category);
    }
  }

  return allowed;
};

const matchesLabelOrBankKey = (item: RecurringItem, needle: string): boolean =>
  needle.length === 0 ||
  foldForSearch(merchantLabel(item)).includes(needle) ||
  foldForSearch(item.merchantKey).includes(needle);

export const filterRecurringItems = (
  items: RecurringItem[],
  filter: RecurringFilter
): RecurringItem[] => {
  const allowed = categoriesUnionedWithGroups(filter.categories);
  const needle = foldForSearch(filter.search.trim());
  const { max, min } = filter.amount;

  return items.filter((item) => {
    if (allowed !== null && !allowed.has(item.category)) {
      return false;
    }

    if (
      filter.frequencies.length > 0 &&
      !filter.frequencies.includes(item.frequency)
    ) {
      return false;
    }

    if (
      filter.confidences.length > 0 &&
      !filter.confidences.includes(item.confidence)
    ) {
      return false;
    }

    const monthly = fromMinor(monthlyEquivalentMinor(item), item.currency);

    if (min > 0 && monthly < min) {
      return false;
    }

    if (max > 0 && monthly > max) {
      return false;
    }

    return matchesLabelOrBankKey(item, needle);
  });
};

export const sortRecurringItems = (
  items: RecurringItem[],
  sort: RecurringSortMode
): RecurringItem[] =>
  items.toSorted((a, b) =>
    sort === "next"
      ? Date.parse(a.nextExpected) - Date.parse(b.nextExpected) ||
        monthlyEquivalentMinor(b) - monthlyEquivalentMinor(a)
      : monthlyEquivalentMinor(b) - monthlyEquivalentMinor(a) ||
        Date.parse(a.nextExpected) - Date.parse(b.nextExpected)
  );

export const groupRecurringItems = (
  items: RecurringItem[],
  filter: RecurringFilter,
  sort: RecurringSortMode
): RecurringGroups => {
  const [fixed, behavioral] = recurringSections(
    filterRecurringItems(items, filter)
  );

  return {
    behavioral: {
      ...behavioral,
      items: sortRecurringItems(behavioral.items, sort),
    },
    fixed: { ...fixed, items: sortRecurringItems(fixed.items, sort) },
  };
};
