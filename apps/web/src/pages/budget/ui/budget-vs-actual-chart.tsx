import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { cn } from "@freenary/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useRef } from "react";

import type { CategorySelection } from "@/entities/category";
import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import { PRESS_MOTION } from "./list-controls";

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

const PlanTrack = ({
  actualColor,
  actualShare,
  plannedShare,
}: {
  actualColor: string;
  actualShare: number;
  plannedShare: number;
}) => (
  <span className="bg-muted relative block h-2 w-full overflow-hidden rounded-full">
    <span
      className="bg-muted-foreground/25 absolute inset-y-0 start-0 rounded-full"
      style={{ width: `${plannedShare * 100}%` }}
    />
    <span
      className="absolute inset-y-0 start-0 rounded-full"
      style={{ backgroundColor: actualColor, width: `${actualShare * 100}%` }}
    />
  </span>
);

const PlannedRow = ({
  currency,
  entry,
  index,
  isSelected,
  onSelect,
  registerItem,
  scale,
}: {
  currency: string;
  entry: PlannedCategory;
  index: number;
  isSelected: boolean;
  onSelect: (selection: CategorySelection) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
  scale: number;
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
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-md p-1 text-start",
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
      <PlanTrack
        actualColor={
          isOverPlan ? "var(--destructive)" : categoryChartColor(entry.category)
        }
        actualShare={entry.actual / scale}
        plannedShare={entry.planned / scale}
      />
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
  const hover = useFluidHover(listRef);

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

  const sharedScale = Math.max(
    ...categories.map((entry) => Math.max(entry.planned, entry.actual))
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-muted-foreground flex justify-end gap-1 font-mono text-[10px]">
        <span>{m.budget_planned_column_actual()}</span>
        <span aria-hidden="true">/</span>
        <span>{m.budget_planned_column_planned()}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul
          aria-label={m.budget_planned_chart_label()}
          className="relative flex flex-col gap-2"
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
                scale={sharedScale}
              />
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};
