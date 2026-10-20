import { Button } from "@freenary/ui/components/button";
import { Calendar } from "@freenary/ui/components/calendar";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { useHoverIntent } from "../lib/use-hover-intent";
import {
  AGGREGATION_MODES,
  aggregationLabel,
  computeDateRange,
  formatMonthYear,
  formatPeriodLabel,
  isMultiMonth,
  rangeMonths,
  TIME_RANGES,
} from "../model/period";
import type { AggregationMode, TimeRange } from "../model/period";

const YEAR_PAGE_SIZE = 12;

const MONTHS_IN_A_YEAR = 12;

const PeriodLabelHoldingTheWidestMonthOfTheYear = ({
  anchorMonth,
  anchorYear,
  range,
}: {
  anchorMonth: number;
  anchorYear: number;
  range: TimeRange;
}) => {
  const locale = getLocale();
  const span = computeDateRange(anchorYear, anchorMonth, range);

  return (
    <span className="grid justify-items-center">
      <span className="col-start-1 row-start-1">
        {formatPeriodLabel(span.from, span.to, range, locale)}
      </span>
      {Array.from({ length: MONTHS_IN_A_YEAR }, (_, month) => (
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
          key={month}
        >
          {formatMonthYear(new Date(anchorYear, month, 1), locale)}
        </span>
      ))}
    </span>
  );
};

const YearCell = ({
  index,
  isDisabled,
  isSelected,
  onSelect,
  registerItem,
  year,
}: {
  index: number;
  isDisabled: boolean;
  isSelected: boolean;
  onSelect: () => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
  year: number;
}) => {
  const cellRef = useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, cellRef);

  return (
    <Button
      className="tabular-nums [--hover:transparent]"
      disabled={isDisabled}
      onClick={onSelect}
      ref={cellRef}
      variant={isSelected ? "primary" : "ghost"}
    >
      {year}
    </Button>
  );
};

const PeriodYearPicker = ({
  selectedYear,
  minYear,
  maxYear,
  onSelectYear,
}: {
  selectedYear: number;
  minYear?: number;
  maxYear?: number;
  onSelectYear: (year: number) => void;
}) => {
  const [pageStart, setPageStart] = useState(
    selectedYear - (selectedYear % YEAR_PAGE_SIZE)
  );

  const years = Array.from({ length: YEAR_PAGE_SIZE }, (_, i) => pageStart + i);
  const gridRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(gridRef, {
    axis: "xy",
    isItemDisabled: (element) => element.matches(":disabled"),
  });

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-compact"
          onClick={() => setPageStart((p) => p - YEAR_PAGE_SIZE)}
          aria-label={m.budget_year_picker_previous()}
        >
          <RiArrowLeftSLine />
        </Button>
        <span className="text-xs font-medium tabular-nums">
          {pageStart} – {pageStart + YEAR_PAGE_SIZE - 1}
        </span>
        <Button
          variant="ghost"
          size="icon-compact"
          onClick={() => setPageStart((p) => p + YEAR_PAGE_SIZE)}
          aria-label={m.budget_year_picker_next()}
        >
          <RiArrowRightSLine />
        </Button>
      </div>
      <div
        className="relative grid grid-cols-3 gap-1"
        ref={gridRef}
        {...hover.handlers}
      >
        <FluidHoverHighlight className="rounded-lg" hover={hover} />
        {years.map((year, index) => (
          <YearCell
            index={index}
            isDisabled={
              (minYear !== undefined && year < minYear) ||
              (maxYear !== undefined && year > maxYear)
            }
            isSelected={year === selectedYear}
            key={year}
            onSelect={() => onSelectYear(year)}
            registerItem={hover.registerItem}
            year={year}
          />
        ))}
      </div>
    </div>
  );
};

export const PeriodNavigator = ({
  aggregation,
  to,
  range,
  firstMonth,
  lastMonth,
  onAggregationChange,
  onRangeChange,
  onRangeIntent,
  onMonthChange,
  onMonthIntent,
}: {
  aggregation: AggregationMode;
  to: Date;
  range: TimeRange;
  firstMonth?: Date;
  lastMonth?: Date;
  onAggregationChange: (mode: AggregationMode) => void;
  onRangeChange: (range: TimeRange) => void;
  onRangeIntent: (range: TimeRange) => void;
  onMonthChange: (year: number, month: number) => void;
  onMonthIntent: (year: number, month: number) => void;
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const anchorMonth = to.getMonth();
  const anchorYear = to.getFullYear();
  const step = rangeMonths(range);

  const navigate = (direction: number) => {
    const stepped = new Date(anchorYear, anchorMonth + direction * step, 1);

    onMonthChange(stepped.getFullYear(), stepped.getMonth());
  };

  const stepIntent = useHoverIntent<number>((direction) => {
    const stepped = new Date(anchorYear, anchorMonth + direction * step, 1);

    onMonthIntent(stepped.getFullYear(), stepped.getMonth());
  });

  const rangeIntent = useHoverIntent(onRangeIntent);

  const canGoBack =
    !firstMonth || new Date(anchorYear, anchorMonth - step, 1) >= firstMonth;

  const canGoForward =
    !lastMonth || new Date(anchorYear, anchorMonth + step, 1) <= lastMonth;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-compact"
          disabled={!canGoBack}
          onClick={() => navigate(-1)}
          aria-label={m.budget_period_previous()}
          {...stepIntent(-1)}
        >
          <RiArrowLeftSLine />
        </Button>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger render={<Button variant="ghost" />}>
            <PeriodLabelHoldingTheWidestMonthOfTheYear
              anchorMonth={anchorMonth}
              anchorYear={anchorYear}
              range={range}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            {range === "1Y" ? (
              <PeriodYearPicker
                selectedYear={anchorYear}
                minYear={firstMonth?.getFullYear()}
                maxYear={lastMonth?.getFullYear()}
                onSelectYear={(year) => {
                  onMonthChange(year, 11);
                  setPopoverOpen(false);
                }}
              />
            ) : (
              <Calendar
                mode="single"
                defaultMonth={to}
                selected={to}
                disabled={[
                  ...(firstMonth ? [{ before: firstMonth }] : []),
                  ...(lastMonth ? [{ after: lastMonth }] : []),
                ]}
                onSelect={(date) => {
                  if (date) {
                    onMonthChange(date.getFullYear(), date.getMonth());
                    setPopoverOpen(false);
                  }
                }}
              />
            )}
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon-compact"
          disabled={!canGoForward}
          onClick={() => navigate(1)}
          aria-label={m.budget_period_next()}
          {...stepIntent(1)}
        >
          <RiArrowRightSLine />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {isMultiMonth(range) && (
          <Select
            value={aggregation}
            onValueChange={(next) => {
              const mode = AGGREGATION_MODES.find(
                (candidate) => candidate === next
              );

              if (mode) {
                onAggregationChange(mode);
              }
            }}
          >
            <SelectTrigger />
            <SelectContent>
              <SelectGroup>
                {AGGREGATION_MODES.map((mode, position) => (
                  <SelectItem index={position} key={mode} value={mode}>
                    {aggregationLabel(mode)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <ToggleGroup
          value={[range]}
          onValueChange={([next]) => {
            const timeRange = TIME_RANGES.find((r) => r === next);

            if (timeRange) {
              onRangeChange(timeRange);
            }
          }}
        >
          {TIME_RANGES.map((r) => (
            <ToggleGroupItem
              key={r}
              value={r}
              {...(r === range ? undefined : rangeIntent(r))}
            >
              {r}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};
