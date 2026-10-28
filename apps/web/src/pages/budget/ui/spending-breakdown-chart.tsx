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
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { PieSectorDataItem } from "recharts";

import type { CategorySelection } from "@/entities/category";
import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ChartTooltipCard } from "@/shared/ui/chart-tooltip";

import {
  breakdownSlices,
  isSliceSelected,
  sliceCategories,
} from "../model/spending-breakdown";
import type {
  BreakdownSlice,
  CategoryAmount,
} from "../model/spending-breakdown";
import { PRESS_MOTION } from "./list-controls";

interface SpendingBreakdownChartProps {
  activeCategories: SpendingCategory[];
  categories: CategoryAmount[];
  currency: string;
  onSelect?: (selection: CategorySelection | null) => void;
}

const UNSELECTED_OPACITY = 0.3;
const OTHER_SLICE_KEY = "other";
const OTHER_SLICE_COLOR = `color-mix(in oklab, ${CHART_COLOR_VARS.grey} 35%, var(--foreground))`;

const LEGEND_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';

const revealOtherContents = (contents: HTMLElement | null) => {
  const otherChip = contents?.previousElementSibling;
  const viewport = contents?.closest(LEGEND_VIEWPORT_SELECTOR);

  if (!(otherChip instanceof HTMLElement && viewport instanceof HTMLElement)) {
    return;
  }

  const otherChipOffset =
    otherChip.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top;

  viewport.scrollTo({ top: viewport.scrollTop + otherChipOffset });
};

const sliceKey = (slice: BreakdownSlice): string =>
  slice.kind === "other" ? OTHER_SLICE_KEY : slice.category;

const sliceSelection = (slice: BreakdownSlice): CategorySelection =>
  slice.kind === "other"
    ? { categories: sliceCategories(slice), kind: "categories" }
    : { category: slice.category, kind: "category" };

const buildConfigKeyedByCategorySlug = (
  slices: BreakdownSlice[]
): ChartConfig => {
  const config: ChartConfig = {};

  for (const slice of slices) {
    config[sliceKey(slice)] =
      slice.kind === "other"
        ? {
            color: OTHER_SLICE_COLOR,
            label: m.budget_breakdown_other({ count: slice.categories.length }),
          }
        : {
            color: categoryChartColor(slice.category),
            label: categoryLabel(slice.category),
          };
  }

  return config;
};

const SpendingBreakdownTooltip = ({
  active,
  config,
  currency,
  payload,
  total,
}: {
  active?: boolean;
  config: ChartConfig;
  currency: string;
  payload?: { payload?: BreakdownSlice }[];
  total: number;
}) => {
  const slice = active ? payload?.[0]?.payload : undefined;

  if (!slice) {
    return null;
  }

  const key = sliceKey(slice);
  const share = total > 0 ? Math.round((slice.amount / total) * 100) : 0;

  return (
    <ChartTooltipCard className="min-w-32">
      <div className="flex flex-1 items-center justify-between gap-3 leading-none">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: config[key]?.color }}
          />
          <span className="text-muted-foreground whitespace-nowrap">
            {config[key]?.label ?? key}
          </span>
        </span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {formatCurrency(slice.amount, currency)} ({share}%)
        </span>
      </div>
    </ChartTooltipCard>
  );
};

const LegendChip = ({
  amount,
  color,
  currency,
  index,
  isSelected,
  label,
  onToggle,
  registerItem,
}: {
  amount: number;
  color: string | undefined;
  currency: string;
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
        <span className="text-foreground">
          {formatCurrency(amount, currency)}
        </span>
      </motion.button>
    </li>
  );
};

export const SpendingBreakdownChart = ({
  activeCategories,
  categories,
  currency,
  onSelect,
}: SpendingBreakdownChartProps) => {
  const slices = useMemo(() => breakdownSlices(categories), [categories]);
  const config = buildConfigKeyedByCategorySlug(slices);

  const legendRef = useRef<HTMLUListElement>(null);
  const legendHover = useFluidHover(legendRef, { axis: "xy" });

  const total = categories.reduce((sum, entry) => sum + entry.amount, 0);
  const isSelected = (slice: BreakdownSlice) =>
    isSliceSelected(slice, activeCategories);

  const hasSelection = slices.some(isSelected);
  const otherSlice = slices.find((slice) => slice.kind === "other");
  const openOther =
    otherSlice?.kind === "other" && isSelected(otherSlice)
      ? otherSlice
      : undefined;

  const isOtherOpen = openOther !== undefined;
  const otherContentsRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isOtherOpen) {
      revealOtherContents(otherContentsRef.current);
    }
  }, [isOtherOpen]);

  const selectSlice = useCallback(
    (_sector: PieSectorDataItem, index: number) => {
      const slice = slices[index];

      if (slice) {
        onSelect?.(sliceSelection(slice));
      }
    },
    [onSelect, slices]
  );

  if (slices.length === 0) {
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
            content={
              <SpendingBreakdownTooltip
                config={config}
                currency={currency}
                total={total}
              />
            }
          />
          <Pie
            data={slices}
            isAnimationActive={false}
            dataKey="amount"
            nameKey="kind"
            innerRadius="55%"
            outerRadius="100%"
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={onSelect ? selectSlice : undefined}
          >
            {slices.map((slice) => (
              <Cell
                key={sliceKey(slice)}
                fill={config[sliceKey(slice)]?.color}
                fillOpacity={
                  hasSelection && !isSelected(slice) ? UNSELECTED_OPACITY : 1
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
          {slices.map((slice, index) => (
            <LegendChip
              amount={slice.amount}
              color={config[sliceKey(slice)]?.color}
              currency={currency}
              index={index}
              isSelected={isSelected(slice)}
              key={sliceKey(slice)}
              label={config[sliceKey(slice)]?.label ?? sliceKey(slice)}
              onToggle={
                onSelect ? () => onSelect(sliceSelection(slice)) : undefined
              }
              registerItem={legendHover.registerItem}
            />
          ))}
          {openOther ? (
            <li className="basis-full" ref={otherContentsRef}>
              <ul
                aria-label={m.budget_breakdown_other_contents()}
                className="border-border flex flex-wrap gap-x-4 gap-y-1.5 border-l pl-2"
              >
                {openOther.categories.map((entry, place) => (
                  <LegendChip
                    amount={entry.amount}
                    color={categoryChartColor(entry.category)}
                    currency={currency}
                    index={slices.length + place}
                    isSelected={activeCategories.includes(entry.category)}
                    key={entry.category}
                    label={categoryLabel(entry.category)}
                    onToggle={
                      onSelect
                        ? () =>
                            onSelect({
                              category: entry.category,
                              kind: "category",
                            })
                        : undefined
                    }
                    registerItem={legendHover.registerItem}
                  />
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
};
