import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiRepeatLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { CategoryFilter } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { recurringInsights, recurringSummary } from "../model/recurring";
import type {
  RecurrenceConfidence,
  RecurrenceFrequency,
} from "../model/recurring";
import { groupRecurringItems } from "../model/recurring-filters";
import { BUDGET_SEARCH_DEFAULTS } from "../model/search";
import type { AmountRange } from "../model/transaction-filters";
import { useRecurringView } from "../model/use-recurring-view";
import { useSyncProgress } from "../model/use-sync-progress";
import { RecurringCharts } from "./recurring-charts";
import { RecurringInsights } from "./recurring-insights";
import { RecurringKpiStrip } from "./recurring-kpi-strip";
import { RecurringList } from "./recurring-list";

export const RecurringPage = () => {
  const {
    applyPatch,
    companion,
    filter,
    kind,
    searchQuery,
    setSearchQuery,
    sort,
    view,
  } = useRecurringView();

  const recurringQuery = useQuery(orpc.budget.getRecurring.queryOptions());
  const { data: recurring } = recurringQuery;
  const { isError } = recurringQuery;
  const accountsQuery = useQuery(orpc.budget.getAccounts.queryOptions());
  const syncProgress = useSyncProgress();
  const isAwaitingFirstData =
    syncProgress !== null &&
    accountsQuery.isSuccess &&
    accountsQuery.data.firstTransactionDate === null;

  const isPending = recurringQuery.isLoading || isAwaitingFirstData;

  const asOf = useMemo(
    () => (recurring ? new Date(recurring.asOf) : new Date()),
    [recurring]
  );

  const derived = useMemo(
    () =>
      recurring
        ? {
            insights: recurringInsights(recurring, asOf),
            summary: recurringSummary(recurring, asOf),
          }
        : null,
    [asOf, recurring]
  );

  const groups = useMemo(
    () => groupRecurringItems(recurring?.items ?? [], filter, sort),
    [recurring, filter, sort]
  );

  const handleCategoriesChange = useCallback(
    (next: CategoryFilter) =>
      applyPatch({ rcat: next.categories, rgrp: next.groups }),
    [applyPatch]
  );

  const handleAmountChange = useCallback(
    (next: AmountRange) => applyPatch({ rmax: next.max, rmin: next.min }),
    [applyPatch]
  );

  const handleFrequenciesChange = useCallback(
    (next: RecurrenceFrequency[]) => applyPatch({ rfreq: next }),
    [applyPatch]
  );

  const handleConfidencesChange = useCallback(
    (next: RecurrenceConfidence[]) => applyPatch({ rconf: next }),
    [applyPatch]
  );

  const handleClearFilters = useCallback(
    () =>
      applyPatch({
        rcat: [],
        rconf: [],
        rfreq: [],
        rgrp: [],
        rmax: BUDGET_SEARCH_DEFAULTS.rmax,
        rmin: BUDGET_SEARCH_DEFAULTS.rmin,
      }),
    [applyPatch]
  );

  const currency = recurring?.currency ?? "EUR";

  if (
    recurring !== undefined &&
    recurring.items.length === 0 &&
    !isAwaitingFirstData
  ) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-muted-foreground text-xs">
          {m.budget_recurring_scope()}
        </p>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiRepeatLine />
            </EmptyMedia>
            <EmptyTitle>{m.budget_recurring_empty_title()}</EmptyTitle>
            <EmptyDescription>
              {m.budget_recurring_empty_body()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-muted-foreground text-xs">
        {m.budget_recurring_scope()}
      </p>

      <RecurringInsights
        currency={currency}
        insights={derived?.insights ?? []}
        isPending={isPending}
      />

      <RecurringKpiStrip
        currency={currency}
        isError={isError}
        isPending={isPending}
        summary={derived?.summary}
      />

      <RecurringCharts
        companion={companion}
        data={recurring}
        isError={isError}
        isPending={isPending}
        onCompanionChange={(next) => applyPatch({ rcomp: next })}
        onViewChange={(next) => applyPatch({ rview: next })}
        view={view}
      />

      <RecurringList
        asOf={asOf}
        currency={currency}
        filter={filter}
        groups={groups}
        isError={isError}
        isPending={isPending}
        kind={kind}
        onAmountChange={handleAmountChange}
        onCategoriesChange={handleCategoriesChange}
        onClearFilters={handleClearFilters}
        onConfidencesChange={handleConfidencesChange}
        onFrequenciesChange={handleFrequenciesChange}
        onKindChange={(next) => applyPatch({ rkind: next })}
        onSearchChange={setSearchQuery}
        onSortChange={(next) => applyPatch({ rsort: next })}
        search={searchQuery}
        sort={sort}
      />
    </div>
  );
};
