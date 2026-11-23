import { TRANSACTION_DIRECTIONS } from "@freenary/api/lib/taxonomy";
import {
  lenientTransactionFiltersSchema,
  MAX_SEARCH_TEXT_LENGTH,
} from "@freenary/api/lib/transaction-filters";
import { z } from "zod";

import {
  absentUnlessNonEmptyText,
  absentUnlessOneOf,
  absentWhenDefault,
  absentWhenEmpty,
} from "@/shared/routing";

export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

export type SortMode = (typeof SORT_MODES)[number];

export type TransactionListSearch = z.infer<typeof transactionListSearchSchema>;

export const SORT_MODES = ["date", "amount"] as const;

const absentUnlessFilters = lenientTransactionFiltersSchema
  .transform((kept) => (kept.length > 0 ? kept : undefined))
  .optional();

export const transactionListSearchSchema = z.object({
  dir: absentUnlessOneOf(TRANSACTION_DIRECTIONS),
  filters: absentUnlessFilters,
  q: absentUnlessNonEmptyText(MAX_SEARCH_TEXT_LENGTH),
  sort: absentUnlessOneOf(SORT_MODES),
});

export const TRANSACTION_LIST_SEARCH_DEFAULTS = {
  dir: "outgoing",
  q: "",
  sort: "date",
} as const satisfies Partial<TransactionListSearch>;

export const nextTransactionListSearch = (
  current: TransactionListSearch,
  patch: TransactionListSearch
): TransactionListSearch => ({
  dir: absentWhenDefault(
    patch.dir ?? current.dir,
    TRANSACTION_LIST_SEARCH_DEFAULTS.dir
  ),
  filters: absentWhenEmpty(patch.filters ?? current.filters),
  q: absentWhenDefault(
    patch.q ?? current.q,
    TRANSACTION_LIST_SEARCH_DEFAULTS.q
  ),
  sort: absentWhenDefault(
    patch.sort ?? current.sort,
    TRANSACTION_LIST_SEARCH_DEFAULTS.sort
  ),
});
