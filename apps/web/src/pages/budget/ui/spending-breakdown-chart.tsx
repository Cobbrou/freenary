import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { PieChart } from "@freenary/ui/components/charts/pie-chart";
import type { PieData } from "@freenary/ui/components/charts/pie-context";
import { PieSlice } from "@freenary/ui/components/charts/pie-slice";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { cn } from "@freenary/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { CategorySelection } from "@/entities/category";
import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { PRESS_MOTION } from "@/shared/ui/list-controls";

import {
  breakdownSlices,
  isSliceSelected,
  sliceCategories,
} from "../model/spending-breakdown";
import type {
  BreakdownSlice,
  CategoryAmount,
} from "../model/spending-breakdown";

interface SpendingBreakdownChartProps {
  activeCategories: SpendingCategory[];
  categories: CategoryAmount[];
  currency: string;
  onSelect?: (selection: CategorySelection | null) => void;
}

interface SliceStyle {
  color: string;
  label: string;
}

const PIE_SIZE = 176;
const PIE_INNER_RADIUS = 44;
const UNSELECTED_SHARE = "30%";
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

const sliceStyle = (slice: BreakdownSlice): SliceStyle =>
  slice.kind === "other"
    ? {
        color: OTHER_SLICE_COLOR,
        label: m.budget_breakdown_other({ count: slice.categories.length }),
      }
    : {
        color: categoryChartColor(slice.category),
        label: categoryLabel(slice.category),
      };

const unselectedColor = (color: string): string =>
  `color-mix(in oklab, ${color} ${UNSELECTED_SHARE}, transparent)`;

const sharePercent = (amount: number, total: number): number =>
  total > 0 ? Math.round((amount / total) * 100) : 0;

const BreakdownCenter = ({
  currency,
  hovered,
  total,
}: {
  currency: string;
  hovered: { amount: number; style: SliceStyle } | undefined;
  total: number;
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 flex items-center justify-center"
  >
    <div className="flex max-w-20 flex-col items-center gap-0.5 text-center">
      <span className="text-foreground font-mono text-[11px] font-medium tabular-nums">
        {formatCurrency(hovered?.amount ?? total, currency)}
      </span>
      <span className="text-muted-foreground max-w-full truncate text-[10px] leading-tight">
        {hovered
          ? `${hovered.style.label} · ${sharePercent(hovered.amount, total)}%`
          : m.chart_total()}
      </span>
    </div>
  </div>
);

const LegendChip = ({
  amount,
  color,
  currency,
  index,
  isSelected,
  label,
  onHoverChange,
  onToggle,
  registerItem,
}: {
  amount: number;
  color: string | undefined;
  currency: string;
  index: number;
  isSelected: boolean;
  label: ReactNode;
  onHoverChange?: (hovered: boolean) => void;
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
        onBlur={() => onHoverChange?.(false)}
        onClick={onToggle}
        onFocus={() => onHoverChange?.(true)}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
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
  const styles = useMemo(() => slices.map(sliceStyle), [slices]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const legendRef = useRef<HTMLUListElement>(null);
  const legendHover = useFluidHover(legendRef, { axis: "xy", nearest: true });

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

  const pieData = useMemo(
    (): PieData[] =>
      slices.map((slice, index) => {
        const color = styles[index]?.color ?? OTHER_SLICE_COLOR;
        const dimmed =
          hasSelection && !isSliceSelected(slice, activeCategories);

        return {
          color: dimmed ? unselectedColor(color) : color,
          label: styles[index]?.label ?? sliceKey(slice),
          value: slice.amount,
        };
      }),
    [activeCategories, hasSelection, slices, styles]
  );

  if (slices.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_breakdown_empty()}
      </p>
    );
  }

  const hoveredSlice = hoveredIndex === null ? undefined : slices[hoveredIndex];
  const hoveredStyle = hoveredIndex === null ? undefined : styles[hoveredIndex];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative mx-auto shrink-0">
        <PieChart
          data={pieData}
          hoveredIndex={hoveredIndex}
          innerRadius={PIE_INNER_RADIUS}
          onHoverChange={setHoveredIndex}
          size={PIE_SIZE}
        >
          {slices.map((slice, index) =>
            onSelect ? (
              <g
                key={sliceKey(slice)}
                onClick={() => onSelect(sliceSelection(slice))}
              >
                <PieSlice hoverEffect="grow" index={index} />
              </g>
            ) : (
              <PieSlice
                hoverEffect="grow"
                index={index}
                key={sliceKey(slice)}
              />
            )
          )}
        </PieChart>
        <BreakdownCenter
          currency={currency}
          hovered={
            hoveredSlice && hoveredStyle
              ? { amount: hoveredSlice.amount, style: hoveredStyle }
              : undefined
          }
          total={total}
        />
      </div>
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
              color={styles[index]?.color}
              currency={currency}
              index={index}
              isSelected={isSelected(slice)}
              key={sliceKey(slice)}
              label={styles[index]?.label ?? sliceKey(slice)}
              onHoverChange={(hovered) =>
                setHoveredIndex(hovered ? index : null)
              }
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
