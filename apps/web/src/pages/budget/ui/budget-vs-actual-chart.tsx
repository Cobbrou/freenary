import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import { Bar } from "@freenary/ui/components/charts/bar";
import { BarChart } from "@freenary/ui/components/charts/bar-chart";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { cn } from "@freenary/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useRef } from "react";

import type { CategorySelection } from "@/entities/category";
import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { PRESS_MOTION } from "@/shared/ui/list-controls";

interface PlannedCategory {
  actual: number;
  category: SpendingCategory;
  planned: number;
}

interface BudgetVsActualChartProps {
  activeCategories: SpendingCategory[];
  categories: PlannedCategory[];
  currency: string;
  hasPlan: boolean;
  onSelect: (selection: CategorySelection) => void;
}

interface PlanBarRow extends Record<string, unknown> {
  name: SpendingCategory;
}

const ROW_HEIGHT_PX = 40;
const BAR_THICKNESS_PX = 8;
const BAR_BOTTOM_INSET_PX = 6;
const BAND_PADDING = 1 - BAR_THICKNESS_PX / ROW_HEIGHT_PX;

const BARS_MARGIN = {
  bottom: BAR_BOTTOM_INSET_PX - BAND_PADDING * ROW_HEIGHT_PX,
  left: 4,
  right: 4,
  top: -BAR_BOTTOM_INSET_PX,
};

const OVER_PLAN_KEY = "overPlan";
const LEFT_IN_PLAN_KEY = "leftInPlan";

const LEFT_IN_PLAN_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 25%, transparent)";

const spentKeyOf = (category: SpendingCategory) => `spent:${category}`;

const planBarRow = (entry: PlannedCategory): PlanBarRow => {
  const spentKey = spentKeyOf(entry.category);

  if (entry.planned <= 0) {
    return { [spentKey]: entry.actual, name: entry.category };
  }

  if (entry.actual > entry.planned) {
    return {
      [OVER_PLAN_KEY]: entry.actual - entry.planned,
      [spentKey]: entry.planned,
      name: entry.category,
    };
  }

  return {
    [LEFT_IN_PLAN_KEY]: entry.planned - entry.actual,
    [spentKey]: entry.actual,
    name: entry.category,
  };
};

const PlanBars = ({ categories }: { categories: PlannedCategory[] }) => {
  const rows = useMemo(() => categories.map(planBarRow), [categories]);
  const chartHeight = categories.length * ROW_HEIGHT_PX;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: chartHeight }}
    >
      <BarChart
        aspectRatio="auto"
        barGap={BAND_PADDING}
        className="h-full"
        data={rows}
        margin={BARS_MARGIN}
        orientation="horizontal"
        stacked
        xDataKey="name"
      >
        {categories.map((entry) => (
          <Bar
            dataKey={spentKeyOf(entry.category)}
            fill={categoryChartColor(entry.category)}
            key={entry.category}
            lineCap="butt"
          />
        ))}
        <Bar dataKey={OVER_PLAN_KEY} fill="var(--destructive)" lineCap="butt" />
        <Bar
          dataKey={LEFT_IN_PLAN_KEY}
          fill={LEFT_IN_PLAN_COLOR}
          lineCap="butt"
        />
      </BarChart>
    </div>
  );
};

const PlannedRow = ({
  currency,
  entry,
  index,
  isSelected,
  onSelect,
  registerItem,
}: {
  currency: string;
  entry: PlannedCategory;
  index: number;
  isSelected: boolean;
  onSelect: (selection: CategorySelection) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
}) => {
  const hasPlanForCategory = entry.planned > 0;
  const isOverPlan = hasPlanForCategory && entry.actual > entry.planned;
  const rowRef = useRef<HTMLButtonElement>(null);

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <motion.button
      {...PRESS_MOTION}
      aria-pressed={isSelected}
      className={cn(
        "flex h-10 w-full cursor-pointer flex-col rounded-md p-1 text-start",
        isSelected ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => onSelect({ category: entry.category, kind: "category" })}
      ref={rowRef}
      type="button"
    >
      <span className="flex items-baseline gap-2 text-xs">
        <span className="truncate">{categoryLabel(entry.category)}</span>
        <span
          className={cn(
            "shrink-0 text-[10px]",
            isOverPlan ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isOverPlan &&
            m.budget_planned_over({
              amount: formatCurrency(entry.actual - entry.planned, currency),
            })}
          {hasPlanForCategory &&
            !isOverPlan &&
            m.budget_planned_under({
              amount: formatCurrency(entry.planned - entry.actual, currency),
            })}
          {!hasPlanForCategory && m.budget_planned_unplanned()}
        </span>
        <span className="ms-auto shrink-0 font-mono text-[11px] tabular-nums">
          <span className={isOverPlan ? "text-destructive" : "text-foreground"}>
            {formatCurrency(entry.actual, currency)}
          </span>
          {hasPlanForCategory && (
            <span className="text-muted-foreground">
              {" / "}
              {formatCurrency(entry.planned, currency)}
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
};

export const BudgetVsActualChart = ({
  activeCategories,
  categories,
  currency,
  hasPlan,
  onSelect,
}: BudgetVsActualChartProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const hover = useFluidHover(listRef, { nearest: true });

  if (!hasPlan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-muted-foreground text-xs">
          {m.budget_planned_empty()}
        </p>
        <motion.div {...PRESS_MOTION} className="inline-flex">
          <Button asChild variant="tertiary">
            <Link search={{ section: "budget" }} to="/settings">
              {m.budget_planned_empty_cta()}
            </Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_breakdown_empty()}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-muted-foreground flex justify-end gap-1 font-mono text-[10px]">
        <span>{m.budget_planned_column_actual()}</span>
        <span aria-hidden="true">/</span>
        <span>{m.budget_planned_column_planned()}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="relative">
          <ul
            aria-label={m.budget_planned_chart_label()}
            className="relative flex flex-col"
            ref={listRef}
            {...hover.handlers}
          >
            <FluidHoverHighlight className="rounded-lg" hover={hover} />
            {categories.map((entry, index) => (
              <li key={entry.category}>
                <PlannedRow
                  currency={currency}
                  entry={entry}
                  index={index}
                  isSelected={activeCategories.includes(entry.category)}
                  onSelect={onSelect}
                  registerItem={hover.registerItem}
                />
              </li>
            ))}
          </ul>
          <PlanBars categories={categories} />
        </div>
      </ScrollArea>
    </div>
  );
};
