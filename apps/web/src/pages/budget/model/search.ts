import {
  CATEGORY_GROUPS,
  SPENDING_CATEGORIES,
  TRANSACTION_DIRECTIONS,
} from "@freenary/api/lib/taxonomy";
import { z } from "zod";

import { AGGREGATION_MODES, TIME_RANGES } from "./period";
import {
  RECURRENCE_CONFIDENCES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_KINDS,
} from "./recurring";

export type PrimaryView = (typeof PRIMARY_VIEWS)[number];

export type CompanionView = (typeof COMPANION_VIEWS)[number];

export type RecurringView = (typeof RECURRING_VIEWS)[number];

export type RecurringCompanionView = (typeof RECURRING_COMPANION_VIEWS)[number];

export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

export type SortMode = (typeof SORT_MODES)[number];

export type RecurringSortMode = (typeof RECURRING_SORT_MODES)[number];

export type BudgetSearch = z.infer<typeof budgetSearchSchema>;

export type BudgetSearchPatch = BudgetSearch;

export const PRIMARY_VIEWS = ["flow", "categories"] as const;
export const COMPANION_VIEWS = ["fixed", "planned"] as const;
export const RECURRING_VIEWS = ["trend", "forecast", "scatter"] as const;

export const RECURRING_COMPANION_VIEWS = [
  "categories",
  "frequency",
  "split",
] as const;

export const SORT_MODES = ["date", "amount"] as const;
export const RECURRING_SORT_MODES = ["next", "cost"] as const;

const EARLIEST_PLAUSIBLE_YEAR = 1970;
const LATEST_PLAUSIBLE_YEAR = 2999;

const MAX_PLAUSIBLE_AMOUNT = 1_000_000_000;
const MAX_PICKABLE_MERCHANTS = 50;

const LAST_MONTH_INDEX = 11;

const absentUnlessOneOf = <T extends string>(allowed: readonly T[]) =>
  z
    .unknown()
    .transform((raw) => {
      const parsed = z.enum(allowed).safeParse(raw);

      return parsed.success ? parsed.data : undefined;
    })
    .optional();

const absentUnlessSlugList = <T extends string>(allowed: readonly T[]) =>
  z
    .unknown()
    .transform((raw) => {
      const slug = z.enum(allowed);
      const values = Array.isArray(raw) ? raw : [raw];
      const kept = values.flatMap((value) => {
        const parsed = slug.safeParse(value);

        return parsed.success ? [parsed.data] : [];
      });

      return kept.length > 0 ? kept : undefined;
    })
    .optional();

const absentUnlessBoundedInt = (min: number, max: number) =>
  z
    .unknown()
    .transform((raw) => {
      const parsed = z.number().int().min(min).max(max).safeParse(raw);

      return parsed.success ? parsed.data : undefined;
    })
    .optional();

const absentUnlessNonEmptyText = z
  .unknown()
  .transform((raw) => {
    const parsed = z.coerce.string().safeParse(raw);

    return parsed.success && parsed.data.length > 0 ? parsed.data : undefined;
  })
  .optional();

const absentUnlessPositiveAmount = z
  .unknown()
  .transform((raw) => {
    const parsed = z.coerce
      .number()
      .min(0)
      .max(MAX_PLAUSIBLE_AMOUNT)
      .safeParse(raw);

    return parsed.success && parsed.data > 0 ? parsed.data : undefined;
  })
  .optional();

const absentUnlessMerchantList = z
  .unknown()
  .transform((raw) => {
    const values = Array.isArray(raw) ? raw : [raw];
    const kept = values.flatMap((value) => {
      const parsed = z.coerce.string().safeParse(value);

      return parsed.success && parsed.data.length > 0 ? [parsed.data] : [];
    });

    return kept.length > 0 ? kept.slice(0, MAX_PICKABLE_MERCHANTS) : undefined;
  })
  .optional();

export const budgetSearchSchema = z.object({
  agg: absentUnlessOneOf(AGGREGATION_MODES),
  cat: absentUnlessSlugList(SPENDING_CATEGORIES),
  companion: absentUnlessOneOf(COMPANION_VIEWS),
  dir: absentUnlessOneOf(TRANSACTION_DIRECTIONS),
  grp: absentUnlessSlugList(CATEGORY_GROUPS),
  max: absentUnlessPositiveAmount,
  merchant: absentUnlessMerchantList,
  min: absentUnlessPositiveAmount,
  month: absentUnlessBoundedInt(0, LAST_MONTH_INDEX),
  q: absentUnlessNonEmptyText,
  range: absentUnlessOneOf(TIME_RANGES),
  rcat: absentUnlessSlugList(SPENDING_CATEGORIES),
  rcomp: absentUnlessOneOf(RECURRING_COMPANION_VIEWS),
  rconf: absentUnlessSlugList(RECURRENCE_CONFIDENCES),
  rfreq: absentUnlessSlugList(RECURRENCE_FREQUENCIES),
  rgrp: absentUnlessSlugList(CATEGORY_GROUPS),
  rkind: absentUnlessOneOf(RECURRENCE_KINDS),
  rmax: absentUnlessPositiveAmount,
  rmin: absentUnlessPositiveAmount,
  rq: absentUnlessNonEmptyText,
  rsort: absentUnlessOneOf(RECURRING_SORT_MODES),
  rview: absentUnlessOneOf(RECURRING_VIEWS),
  sort: absentUnlessOneOf(SORT_MODES),
  view: absentUnlessOneOf(PRIMARY_VIEWS),
  year: absentUnlessBoundedInt(EARLIEST_PLAUSIBLE_YEAR, LATEST_PLAUSIBLE_YEAR),
});

export const BUDGET_SEARCH_DEFAULTS = {
  agg: "total",
  companion: "fixed",
  dir: "outgoing",
  max: 0,
  min: 0,
  q: "",
  range: "1M",
  rcomp: "categories",
  rkind: "fixed",
  rmax: 0,
  rmin: 0,
  rq: "",
  rsort: "cost",
  rview: "trend",
  sort: "date",
  view: "flow",
} as const satisfies Partial<BudgetSearch>;

const absentWhenDefault = <T extends number | string>(
  value: T | undefined,
  fallback: T
): T | undefined =>
  value === undefined || value === fallback ? undefined : value;

const absentWhenEmpty = <T extends string>(value: T[] | undefined) =>
  value && value.length > 0 ? value : undefined;

const nextTransactionsSearch = (
  current: BudgetSearch,
  patch: BudgetSearchPatch
) => ({
  agg: absentWhenDefault(patch.agg ?? current.agg, BUDGET_SEARCH_DEFAULTS.agg),
  cat: absentWhenEmpty(patch.cat ?? current.cat),
  companion: absentWhenDefault(
    patch.companion ?? current.companion,
    BUDGET_SEARCH_DEFAULTS.companion
  ),
  dir: absentWhenDefault(patch.dir ?? current.dir, BUDGET_SEARCH_DEFAULTS.dir),
  grp: absentWhenEmpty(patch.grp ?? current.grp),
  max: absentWhenDefault(patch.max ?? current.max, BUDGET_SEARCH_DEFAULTS.max),
  merchant: absentWhenEmpty(patch.merchant ?? current.merchant),
  min: absentWhenDefault(patch.min ?? current.min, BUDGET_SEARCH_DEFAULTS.min),
  month: patch.month ?? current.month,
  q: absentWhenDefault(patch.q ?? current.q, BUDGET_SEARCH_DEFAULTS.q),
  range: absentWhenDefault(
    patch.range ?? current.range,
    BUDGET_SEARCH_DEFAULTS.range
  ),
  sort: absentWhenDefault(
    patch.sort ?? current.sort,
    BUDGET_SEARCH_DEFAULTS.sort
  ),
  view: absentWhenDefault(
    patch.view ?? current.view,
    BUDGET_SEARCH_DEFAULTS.view
  ),
  year: patch.year ?? current.year,
});

const nextRecurringSearch = (
  current: BudgetSearch,
  patch: BudgetSearchPatch
) => ({
  rcat: absentWhenEmpty(patch.rcat ?? current.rcat),
  rcomp: absentWhenDefault(
    patch.rcomp ?? current.rcomp,
    BUDGET_SEARCH_DEFAULTS.rcomp
  ),
  rconf: absentWhenEmpty(patch.rconf ?? current.rconf),
  rfreq: absentWhenEmpty(patch.rfreq ?? current.rfreq),
  rgrp: absentWhenEmpty(patch.rgrp ?? current.rgrp),
  rkind: absentWhenDefault(
    patch.rkind ?? current.rkind,
    BUDGET_SEARCH_DEFAULTS.rkind
  ),
  rmax: absentWhenDefault(
    patch.rmax ?? current.rmax,
    BUDGET_SEARCH_DEFAULTS.rmax
  ),
  rmin: absentWhenDefault(
    patch.rmin ?? current.rmin,
    BUDGET_SEARCH_DEFAULTS.rmin
  ),
  rq: absentWhenDefault(patch.rq ?? current.rq, BUDGET_SEARCH_DEFAULTS.rq),
  rsort: absentWhenDefault(
    patch.rsort ?? current.rsort,
    BUDGET_SEARCH_DEFAULTS.rsort
  ),
  rview: absentWhenDefault(
    patch.rview ?? current.rview,
    BUDGET_SEARCH_DEFAULTS.rview
  ),
});

export const nextBudgetSearch = (
  current: BudgetSearch,
  patch: BudgetSearchPatch
): BudgetSearch => ({
  ...nextTransactionsSearch(current, patch),
  ...nextRecurringSearch(current, patch),
});
