import { ChartContainer, ChartTooltip } from "@freenary/ui/components/chart";
import type { ChartConfig } from "@freenary/ui/components/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ChartTooltipCard } from "@/shared/ui/chart-tooltip";

import { monthKeyLabel } from "../model/recurring";
import type { RecurringMonth } from "../model/recurring";

interface RecurringTrendChartProps {
  currency: string;
  monthly: RecurringMonth[];
}

interface TrendRow {
  behavioralMinor: number;
  discretionaryMinor: number;
  fixedMinor: number;
  label: string;
}

const STACKED_SERIES_BOTTOM_UP = [
  {
    color: CHART_COLOR_VARS.blue,
    key: "fixedMinor",
    label: m.budget_recurring_series_fixed,
  },
  {
    color: CHART_COLOR_VARS.orange,
    key: "behavioralMinor",
    label: m.budget_recurring_series_behavioral,
  },
  {
    color: CHART_COLOR_VARS.grey,
    key: "discretionaryMinor",
    label: m.budget_recurring_series_discretionary,
  },
] as const;

const STACK_ID = "recurring";

const TrendTooltip = ({
  active,
  currency,
  payload,
}: {
  active?: boolean;
  currency: string;
  payload?: { payload?: TrendRow }[];
}) => {
  const row = active ? payload?.[0]?.payload : undefined;

  if (!row) {
    return null;
  }

  return (
    <ChartTooltipCard className="min-w-40">
      <div className="font-medium">{row.label}</div>
      {STACKED_SERIES_BOTTOM_UP.map((series) => (
        <div className="flex items-center gap-2 leading-none" key={series.key}>
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: series.color }}
          />
          <span className="text-muted-foreground flex-1">{series.label()}</span>
          <span className="text-foreground font-mono font-medium tabular-nums">
            {formatCurrency(row[series.key], currency)}
          </span>
        </div>
      ))}
    </ChartTooltipCard>
  );
};

export const RecurringTrendChart = ({
  currency,
  monthly,
}: RecurringTrendChartProps) => {
  const total = monthly.reduce(
    (sum, month) =>
      sum + month.fixedMinor + month.behavioralMinor + month.discretionaryMinor,
    0
  );

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_recurring_trend_empty()}
      </p>
    );
  }

  const config: ChartConfig = Object.fromEntries(
    STACKED_SERIES_BOTTOM_UP.map((series) => [
      series.key,
      { color: series.color, label: series.label() },
    ])
  );

  const locale = getLocale();
  const rows: TrendRow[] = monthly.map((month) => ({
    behavioralMinor: month.behavioralMinor,
    discretionaryMinor: month.discretionaryMinor,
    fixedMinor: month.fixedMinor,
    label: monthKeyLabel(month.month, locale),
  }));

  return (
    <figure className="flex h-full flex-col gap-2">
      <figcaption className="sr-only">
        {m.budget_recurring_trend_chart_label()}
      </figcaption>
      <ChartContainer
        className="aspect-auto min-h-0 w-full flex-1"
        config={config}
      >
        <BarChart
          accessibilityLayer
          data={rows}
          margin={{ left: 6, right: 4, top: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currency)}
            tickLine={false}
            width="auto"
          />
          <ChartTooltip
            content={<TrendTooltip currency={currency} />}
            cursor={false}
          />
          {STACKED_SERIES_BOTTOM_UP.map((series) => (
            <Bar
              dataKey={series.key}
              fill={`var(--color-${series.key})`}
              isAnimationActive={false}
              key={series.key}
              maxBarSize={40}
              name={series.key}
              stackId={STACK_ID}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ul className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1">
        {STACKED_SERIES_BOTTOM_UP.map((series) => (
          <li
            className="text-muted-foreground flex items-center gap-1.5 text-[11px]"
            key={series.key}
          >
            <span
              className="size-2 shrink-0 rounded-[1px]"
              style={{ backgroundColor: series.color }}
            />
            {series.label()}
          </li>
        ))}
      </ul>
    </figure>
  );
};
