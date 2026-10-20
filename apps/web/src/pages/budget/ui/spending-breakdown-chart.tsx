import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { ChartContainer, ChartTooltip } from "@freenary/ui/components/chart";
import type { ChartConfig } from "@freenary/ui/components/chart";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { cn } from "@freenary/ui/lib/utils";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { PieSectorDataItem } from "recharts";

import type { CategorySelection } from "@/entities/category";
import { categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { categoryChartColor } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ChartTooltipCard } from "@/shared/ui/chart-tooltip";

import { PRESS_MOTION } from "./list-controls";

interface CategoryData {
  amount: number;
  category: SpendingCategory;
}

interface SpendingBreakdownChartProps {
  data: CategoryData[];
  onSelect?: (selection: CategorySelection | null) => void;
}

const UNSELECTED_OPACITY = 0.3;

const buildConfigKeyedByCategorySlug = (
  categories: CategoryData[]
): ChartConfig => {
  const config: ChartConfig = {};

  for (const entry of categories) {
    config[entry.category] = {
      color: categoryChartColor(entry.category),
      label: categoryLabel(entry.category),
    };
  }

  return config;
};

const SpendingBreakdownTooltip = ({
  active,
  config,
  payload,
  total,
}: {
  active?: boolean;
  config: ChartConfig;
  payload?: { payload?: CategoryData }[];
  total: number;
}) => {
  const slice = active ? payload?.[0]?.payload : undefined;

  if (!slice) {
    return null;
  }

  const share = total > 0 ? Math.round((slice.amount / total) * 100) : 0;

  return (
    <ChartTooltipCard className="min-w-32">
      <div className="flex flex-1 items-center justify-between gap-3 leading-none">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: config[slice.category]?.color }}
          />
          <span className="text-muted-foreground">
            {config[slice.category]?.label ?? slice.category}
          </span>
        </span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {formatCurrency(slice.amount)} ({share}%)
        </span>
      </div>
    </ChartTooltipCard>
  );
};

const LegendChip = ({
  amount,
  color,
  index,
  isSelected,
  label,
  onToggle,
  registerItem,
}: {
  amount: number;
  color: string | undefined;
  index: number;
  isSelected: boolean;
  label: ReactNode;
  onToggle: (() => void) | undefined;
  registerItem: (index: number, element: HTMLElement | null) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);

  return (
    <li>
      <motion.button
        {...PRESS_MOTION}
        aria-pressed={isSelected}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px]",
          onToggle && "hover:text-foreground cursor-pointer",
          isSelected ? "text-foreground" : "text-muted-foreground"
        )}
        disabled={!onToggle}
        onClick={onToggle}
        ref={ref}
        type="button"
      >
        <span
          className="size-2 rounded-[1px]"
          style={{ backgroundColor: color }}
        />
        <span>{label}</span>
        <span className="text-foreground">{formatCurrency(amount)}</span>
      </motion.button>
    </li>
  );
};

export const SpendingBreakdownChart = ({
  data: categories,
  onSelect,
}: SpendingBreakdownChartProps) => {
  const config = buildConfigKeyedByCategorySlug(categories);
  const [selectedCategory, setSelectedCategory] =
    useState<SpendingCategory | null>(null);

  const legendRef = useRef<HTMLUListElement>(null);
  const legendHover = useFluidHover(legendRef, { axis: "xy" });

  const total = categories.reduce((sum, entry) => sum + entry.amount, 0);

  const toggleCategory = useCallback(
    (category: SpendingCategory) => {
      const next = selectedCategory === category ? null : category;
      setSelectedCategory(next);
      onSelect?.(next === null ? null : { category: next, kind: "category" });
    },
    [onSelect, selectedCategory]
  );

  const selectSlice = useCallback(
    (_sector: PieSectorDataItem, index: number) => {
      const entry = categories[index];

      if (entry) {
        toggleCategory(entry.category);
      }
    },
    [categories, toggleCategory]
  );

  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_breakdown_empty()}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <ChartContainer
        config={config}
        className="mx-auto aspect-square h-auto w-full max-w-[176px] shrink-0"
      >
        <PieChart>
          <ChartTooltip
            content={<SpendingBreakdownTooltip config={config} total={total} />}
          />
          <Pie
            data={categories}
            isAnimationActive={false}
            dataKey="amount"
            nameKey="category"
            innerRadius="55%"
            outerRadius="100%"
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={onSelect ? selectSlice : undefined}
          >
            {categories.map((entry) => (
              <Cell
                key={entry.category}
                fill={config[entry.category]?.color}
                fillOpacity={
                  selectedCategory !== null &&
                  selectedCategory !== entry.category
                    ? UNSELECTED_OPACITY
                    : 1
                }
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ScrollArea className="min-h-0 flex-1">
        <ul
          className="relative flex flex-wrap content-start gap-x-4 gap-y-1.5 px-1"
          ref={legendRef}
          {...legendHover.handlers}
        >
          <FluidHoverHighlight
            className="rounded-lg"
            hidden={!onSelect}
            hover={legendHover}
          />
          {categories.map((d, index) => (
            <LegendChip
              amount={d.amount}
              color={config[d.category]?.color}
              index={index}
              isSelected={selectedCategory === d.category}
              key={d.category}
              label={config[d.category]?.label ?? d.category}
              onToggle={onSelect ? () => toggleCategory(d.category) : undefined}
              registerItem={legendHover.registerItem}
            />
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};
