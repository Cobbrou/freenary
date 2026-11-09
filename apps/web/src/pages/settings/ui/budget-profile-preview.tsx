import { budgetLineKindOfGroup } from "@freenary/api/lib/budget-profile";
import type { CategoryEntry } from "@freenary/api/lib/categories";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { cn } from "@freenary/ui/lib/utils";
import { RiDonutChartLine } from "@remixicon/react";
import { useMemo } from "react";

import { categoryEntryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { SankeyChart } from "@/shared/ui/sankey-chart";

import { toBudgetProfileSankey } from "../model/budget-profile-sankey";
import type { BudgetProfileLine } from "../model/budget-profile-sankey";
import { amountOf } from "../model/use-budget-profile-editor";
import type { EditorLine } from "../model/use-budget-profile-editor";
import { BudgetProfileSummary } from "./budget-profile-summary";

interface BudgetProfilePreviewProps {
  categories: CategoryEntry[];
  currency: string | undefined;
  isPending: boolean;
  lines: EditorLine[];
}

const TYPING_SETTLE_DELAY_MS = 200;

const NOT_LOADED_YET = null;

const LABEL_IS_ALREADY_TRANSLATED_COPY = true;

const EMPTY_TITLE_LINE_BOX = "flex h-5 items-center";

const EMPTY_DESCRIPTION_LINE_BOX = "flex h-[1.625em] items-center";

const FLOW_AND_TOTALS_GAP = "gap-2";

const uncategorisedGroupInCurrentLocale = (): Pick<
  CategoryEntry,
  "color" | "isCustom" | "key" | "label"
> => ({
  color: "grey",
  isCustom: LABEL_IS_ALREADY_TRANSLATED_COPY,
  key: "spending",
  label: m.settings_category_other(),
});

export const BudgetProfilePreview = ({
  categories,
  currency,
  isPending,
  lines,
}: BudgetProfilePreviewProps) => {
  const debouncedLines = useDebouncedValue(
    isPending ? NOT_LOADED_YET : lines,
    TYPING_SETTLE_DELAY_MS
  );

  const profileLines = useMemo<BudgetProfileLine[]>(() => {
    const entryByKey = new Map(
      categories.map((entry) => [entry.key, entry] as const)
    );

    const chartColumnGroupOf = (entry: CategoryEntry | undefined) => {
      if (!entry) {
        return uncategorisedGroupInCurrentLocale();
      }

      const parent = entry.parentKey
        ? entryByKey.get(entry.parentKey)
        : undefined;

      return parent ?? entry;
    };

    return (debouncedLines ?? []).map((line) => {
      const entry = entryByKey.get(line.categoryKey);
      const group = chartColumnGroupOf(entry);
      const amount = amountOf(line.amountInput, currency);
      const categoryLabel = entry ? categoryEntryLabel(entry) : "";

      return {
        amount: Number.isNaN(amount) ? 0 : amount,
        groupColor: group.color,
        groupKey: group.key,
        groupLabel: categoryEntryLabel(group),
        id: line.id,
        kind: budgetLineKindOfGroup(group.key),
        label: line.label.trim() || categoryLabel || m.settings_line_untitled(),
      };
    });
  }, [categories, currency, debouncedLines]);

  const flow = useMemo(
    () => toBudgetProfileSankey(profileLines),
    [profileLines]
  );

  const totals = useMemo(() => {
    let totalAllocated = 0;
    let totalRevenue = 0;

    for (const line of profileLines) {
      if (line.kind === "REVENUE") {
        totalRevenue += line.amount;
      } else {
        totalAllocated += line.amount;
      }
    }

    return { totalAllocated, totalRevenue };
  }, [profileLines]);

  if (debouncedLines === NOT_LOADED_YET || currency === undefined) {
    return (
      <div aria-busy="true">
        <output className="sr-only">{m.settings_budget_flow_loading()}</output>
        <Empty aria-hidden="true" className="bg-muted/40 rounded-lg border p-3">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Skeleton className="size-4 rounded-sm" />
            </EmptyMedia>
            <EmptyTitle>
              <span className={EMPTY_TITLE_LINE_BOX}>
                <Skeleton className="h-3 w-32" />
              </span>
            </EmptyTitle>
            <EmptyDescription>
              <span className={EMPTY_DESCRIPTION_LINE_BOX}>
                <Skeleton className="h-2.5 w-56" />
              </span>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (profileLines.length === 0) {
    return (
      <Empty className="bg-muted/40 rounded-lg border p-3">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiDonutChartLine />
          </EmptyMedia>
          <EmptyTitle>{m.settings_budget_empty_title()}</EmptyTitle>
          <EmptyDescription>
            {m.settings_budget_empty_description()}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={cn("flex flex-col", FLOW_AND_TOTALS_GAP)}>
      <SankeyChart
        columns={flow.columns}
        formatValue={(value) => formatCurrency(value, currency)}
        label={m.settings_budget_flow_chart_label()}
        links={flow.links}
      />
      <BudgetProfileSummary
        currency={currency}
        totalAllocated={totals.totalAllocated}
        totalRevenue={totals.totalRevenue}
      />
    </div>
  );
};
