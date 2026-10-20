import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { RecurrenceKind } from "./recurring";
import type { RecurringFilter } from "./recurring-filters";
import { BUDGET_SEARCH_DEFAULTS, nextBudgetSearch } from "./search";
import type {
  BudgetSearchPatch,
  RecurringCompanionView,
  RecurringSortMode,
  RecurringView,
} from "./search";

const route = getRouteApi("/_auth/budget/recurring");

export const useRecurringView = () => {
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

  const publishSearchText = useCallback(
    (text: string) => applyPatch({ rq: text }),
    [applyPatch]
  );

  const filter = useMemo<RecurringFilter>(
    () => ({
      amount: {
        max: search.rmax ?? BUDGET_SEARCH_DEFAULTS.rmax,
        min: search.rmin ?? BUDGET_SEARCH_DEFAULTS.rmin,
      },
      categories: {
        categories: search.rcat ?? [],
        groups: search.rgrp ?? [],
      },
      confidences: search.rconf ?? [],
      frequencies: search.rfreq ?? [],
      search: search.rq ?? BUDGET_SEARCH_DEFAULTS.rq,
    }),
    [
      search.rcat,
      search.rconf,
      search.rfreq,
      search.rgrp,
      search.rmax,
      search.rmin,
      search.rq,
    ]
  );

  const companion: RecurringCompanionView =
    search.rcomp ?? BUDGET_SEARCH_DEFAULTS.rcomp;

  const kind: RecurrenceKind = search.rkind ?? BUDGET_SEARCH_DEFAULTS.rkind;
  const sort: RecurringSortMode = search.rsort ?? BUDGET_SEARCH_DEFAULTS.rsort;
  const view: RecurringView = search.rview ?? BUDGET_SEARCH_DEFAULTS.rview;

  return {
    applyPatch,
    companion,
    filter,
    kind,
    searchQuery: search.rq ?? BUDGET_SEARCH_DEFAULTS.rq,
    setSearchQuery: publishSearchText,
    sort,
    view,
  };
};
