import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@freenary/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { Skeleton } from "@freenary/ui/components/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";
import { Elevated } from "@freenary/ui/lib/elevated";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { useMemo } from "react";

import { m } from "@/paraglide/messages.js";

import type { RecurringData } from "../model/recurring";
import {
  forecastSeries,
  frequencyCostPoints,
  purchaseFrequency,
  recurringByCategory,
  spendSplit,
} from "../model/recurring";
import { RECURRING_COMPANION_VIEWS, RECURRING_VIEWS } from "../model/search";
import type { RecurringCompanionView, RecurringView } from "../model/search";
import { FrequencyCostChart } from "./frequency-cost-chart";
import { PRESS_MOTION } from "./list-controls";
import { PurchaseFrequencyChart } from "./purchase-frequency-chart";
import { RecurringCategoryChart } from "./recurring-category-chart";
import { RecurringForecastChart } from "./recurring-forecast-chart";
import { RecurringSplitChart } from "./recurring-split-chart";
import { RecurringTrendChart } from "./recurring-trend-chart";

type TrendProps = ComponentProps<typeof RecurringTrendChart>;

type ForecastProps = ComponentProps<typeof RecurringForecastChart>;

type ScatterProps = ComponentProps<typeof FrequencyCostChart>;

type CategoryProps = ComponentProps<typeof RecurringCategoryChart>;

type FrequencyProps = ComponentProps<typeof PurchaseFrequencyChart>;

type SplitProps = ComponentProps<typeof RecurringSplitChart>;

interface RecurringChartsProps {
  companion: RecurringCompanionView;
  data: RecurringData | undefined;
  isError: boolean;
  isPending: boolean;
  onCompanionChange: (view: RecurringCompanionView) => void;
  onViewChange: (view: RecurringView) => void;
  view: RecurringView;
}

const CHART_BODY = "h-[280px]";

const MAX_CATEGORY_ROWS = 8;

const VIEW_TITLE_GETTERS = {
  forecast: m.budget_recurring_forecast_title,
  scatter: m.budget_recurring_scatter_title,
  trend: m.budget_recurring_trend_title,
} satisfies Record<RecurringView, () => string>;

const VIEW_LABELS = {
  forecast: m.budget_recurring_view_forecast,
  scatter: m.budget_recurring_view_scatter,
  trend: m.budget_recurring_view_trend,
} satisfies Record<RecurringView, () => string>;

const COMPANION_LABELS = {
  categories: m.budget_recurring_view_categories,
  frequency: m.budget_recurring_view_frequency,
  split: m.budget_recurring_view_split,
} satisfies Record<RecurringCompanionView, () => string>;

const ChartSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="h-full">
    <output className="sr-only">{label}</output>
    <Skeleton aria-hidden="true" className="h-full" />
  </div>
);

const ChartUnavailable = () => (
  <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
    {m.budget_chart_unavailable()}
  </p>
);

const RecurringPrimaryBody = ({
  forecast,
  isError,
  isPending,
  scatter,
  trend,
  view,
}: {
  forecast: ForecastProps | undefined;
  isError: boolean;
  isPending: boolean;
  scatter: ScatterProps | undefined;
  trend: TrendProps | undefined;
  view: RecurringView;
}) => {
  if (view === "forecast") {
    if (isPending) {
      return <ChartSkeleton label={m.budget_recurring_forecast_loading()} />;
    }

    if (isError || !forecast) {
      return <ChartUnavailable />;
    }

    return <RecurringForecastChart {...forecast} />;
  }

  if (view === "scatter") {
    if (isPending) {
      return <ChartSkeleton label={m.budget_recurring_scatter_loading()} />;
    }

    if (isError || !scatter) {
      return <ChartUnavailable />;
    }

    return <FrequencyCostChart {...scatter} />;
  }

  if (isPending) {
    return <ChartSkeleton label={m.budget_recurring_trend_loading()} />;
  }

  if (isError || !trend) {
    return <ChartUnavailable />;
  }

  return <RecurringTrendChart {...trend} />;
};

const RecurringCompanionBody = ({
  categories,
  frequency,
  isError,
  isPending,
  split,
  view,
}: {
  categories: CategoryProps | undefined;
  frequency: FrequencyProps | undefined;
  isError: boolean;
  isPending: boolean;
  split: SplitProps | undefined;
  view: RecurringCompanionView;
}) => {
  if (view === "frequency") {
    if (isPending) {
      return <ChartSkeleton label={m.budget_recurring_frequency_loading()} />;
    }

    if (isError || !frequency) {
      return <ChartUnavailable />;
    }

    return <PurchaseFrequencyChart {...frequency} />;
  }

  if (view === "split") {
    if (isPending) {
      return <ChartSkeleton label={m.budget_recurring_split_loading()} />;
    }

    if (isError || !split) {
      return <ChartUnavailable />;
    }

    return <RecurringSplitChart {...split} />;
  }

  if (isPending) {
    return <ChartSkeleton label={m.budget_recurring_categories_loading()} />;
  }

  if (isError || !categories) {
    return <ChartUnavailable />;
  }

  return <RecurringCategoryChart {...categories} />;
};

export const RecurringCharts = ({
  companion,
  data: recurring,
  isError,
  isPending,
  onCompanionChange,
  onViewChange,
  view,
}: RecurringChartsProps) => {
  const trend = useMemo(
    () =>
      recurring
        ? { currency: recurring.currency, monthly: recurring.monthly }
        : undefined,
    [recurring]
  );

  const forecast = useMemo(
    () =>
      recurring
        ? {
            currency: recurring.currency,
            points: forecastSeries(recurring, new Date(recurring.asOf)),
          }
        : undefined,
    [recurring]
  );

  const scatter = useMemo(
    () =>
      recurring
        ? {
            currency: recurring.currency,
            points: frequencyCostPoints(recurring.items),
          }
        : undefined,
    [recurring]
  );

  const categories = useMemo(
    () =>
      recurring
        ? {
            currency: recurring.currency,
            rows: recurringByCategory(recurring.items).slice(
              0,
              MAX_CATEGORY_ROWS
            ),
          }
        : undefined,
    [recurring]
  );

  const frequency = useMemo(
    () =>
      recurring
        ? {
            currency: recurring.currency,
            rows: purchaseFrequency(recurring.items),
          }
        : undefined,
    [recurring]
  );

  const split = useMemo(
    () =>
      recurring
        ? { currency: recurring.currency, split: spendSplit(recurring.monthly) }
        : undefined,
    [recurring]
  );

  return (
    <div className="grid grid-cols-1 gap-4 @min-[52rem]/budget:grid-cols-[2fr_1fr]">
      <Elevated className="min-w-0 rounded-xl" offset={1}>
        <Card>
          <CardHeader>
            <CardTitle className="truncate">
              {VIEW_TITLE_GETTERS[view]()}
            </CardTitle>
            <CardAction>
              <ToggleGroup
                aria-label={m.budget_recurring_view_switch_label()}
                onValueChange={([next]) => {
                  const chosen = RECURRING_VIEWS.find(
                    (candidate) => candidate === next
                  );

                  if (chosen) {
                    onViewChange(chosen);
                  }
                }}
                size="sm"
                spacing={0}
                value={[view]}
                variant="outline"
              >
                {RECURRING_VIEWS.map((candidate) => (
                  <ToggleGroupItem
                    render={<motion.button {...PRESS_MOTION} />}
                    key={candidate}
                    value={candidate}
                  >
                    {VIEW_LABELS[candidate]()}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardAction>
          </CardHeader>
          <CardContent className={CHART_BODY}>
            <RecurringPrimaryBody
              forecast={forecast}
              isError={isError}
              isPending={isPending}
              scatter={scatter}
              trend={trend}
              view={view}
            />
          </CardContent>
        </Card>
      </Elevated>

      <Elevated className="min-w-0 rounded-xl" offset={1}>
        <Card>
          <CardHeader>
            <Select
              onValueChange={(next) => {
                const chosen = RECURRING_COMPANION_VIEWS.find(
                  (candidate) => candidate === next
                );

                if (chosen) {
                  onCompanionChange(chosen);
                }
              }}
              size="compact"
              value={companion}
            >
              <motion.div {...PRESS_MOTION} className="flex">
                <SelectTrigger aria-label={m.budget_companion_switch_label()} />
              </motion.div>
              <SelectContent>
                <SelectGroup>
                  {RECURRING_COMPANION_VIEWS.map((candidate, position) => (
                    <SelectItem
                      index={position}
                      key={candidate}
                      value={candidate}
                    >
                      {COMPANION_LABELS[candidate]()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className={CHART_BODY}>
            <RecurringCompanionBody
              categories={categories}
              frequency={frequency}
              isError={isError}
              isPending={isPending}
              split={split}
              view={companion}
            />
          </CardContent>
        </Card>
      </Elevated>
    </div>
  );
};
