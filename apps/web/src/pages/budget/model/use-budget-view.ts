import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { CategoryFilter } from "@/entities/category";

import { BUDGET_SEARCH_DEFAULTS, nextBudgetSearch } from "./search";
import type {
  BudgetSearchPatch,
  CompanionView,
  PrimaryView,
  SortMode,
  TransactionDirection,
} from "./search";
import type { AmountRange } from "./transaction-filters";
import { useBudgetPeriod } from "./use-budget-period";
import type { BudgetPeriodPatch } from "./use-budget-period";

interface BudgetViewOptions {
  dateBounds?: { first: Date | null; last: Date | null };
}

const route = getRouteApi("/_auth/budget/transactions");

export const useBudgetView = ({ dateBounds }: BudgetViewOptions) => {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const applyPatch = useCallback(
    (patch: BudgetSearchPatch) => {
      navigate({
        replace: true,
        resetScroll: false,
        search: (prev) => nextBudgetSearch(prev, patch),
      });
    },
    [navigate]
  );

  const handlePeriodChange = useCallback(
    (patch: BudgetPeriodPatch) =>
      applyPatch({
        agg: patch.aggregation,
        month: patch.month,
        range: patch.range,
        year: patch.year,
      }),
    [applyPatch]
  );

  const period = useBudgetPeriod({
    aggregation: search.agg,
    dateBounds,
    month: search.month,
    onChange: handlePeriodChange,
    range: search.range,
    year: search.year,
  });

  const filter = useMemo<CategoryFilter>(
    () => ({ categories: search.cat ?? [], groups: search.grp ?? [] }),
    [search.cat, search.grp]
  );

  const amount = useMemo<AmountRange>(
    () => ({
      max: search.max ?? BUDGET_SEARCH_DEFAULTS.max,
      min: search.min ?? BUDGET_SEARCH_DEFAULTS.min,
    }),
    [search.max, search.min]
  );

  const merchants = useMemo(() => search.merchant ?? [], [search.merchant]);

  const publishSearchText = useCallback(
    (text: string) => applyPatch({ q: text }),
    [applyPatch]
  );

  const companion: CompanionView =
    search.companion ?? BUDGET_SEARCH_DEFAULTS.companion;

  const direction: TransactionDirection =
    search.dir ?? BUDGET_SEARCH_DEFAULTS.dir;

  const sort: SortMode = search.sort ?? BUDGET_SEARCH_DEFAULTS.sort;
  const view: PrimaryView = search.view ?? BUDGET_SEARCH_DEFAULTS.view;

  return {
    amount,
    applyPatch,
    companion,
    direction,
    filter,
    merchants,
    period,
    searchQuery: search.q ?? BUDGET_SEARCH_DEFAULTS.q,
    setSearchQuery: publishSearchText,
    sort,
    view,
  };
};
