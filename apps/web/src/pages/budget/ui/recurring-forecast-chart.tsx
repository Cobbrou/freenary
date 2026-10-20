import { ChartContainer, ChartTooltip } from "@freenary/ui/components/chart";
import type { ChartConfig } from "@freenary/ui/components/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ChartTooltipCard } from "@/shared/ui/chart-tooltip";

import type { ForecastPoint } from "../model/recurring";

interface RecurringForecastChartProps {
  currency: string;
  points: ForecastPoint[];
}

interface ForecastRow {
  balanceMinor: number;
  day: number;
  dueLabels: string;
  dueMinor: number;
  label: string;
}

const BALANCE_KEY = "balanceMinor";

const DAYS_BETWEEN_TICKS = 5;

const AREA_FILL_OPACITY = 0.15;

const DAY_TICK: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

const CHART_MARGIN = { left: 6, right: 24, top: 4 };

const ForecastTooltip = ({
  active,
  currency,
  payload,
}: {
  active?: boolean;
  currency: string;
  payload?: { payload?: ForecastRow }[];
}) => {
  const row = active ? payload?.[0]?.payload : undefined;

  if (!row) {
    return null;
  }

  return (
    <ChartTooltipCard className="min-w-40">
      <div className="font-medium">{row.label}</div>
      <div className="flex items-center gap-2 leading-none">
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: CHART_COLOR_VARS.blue }}
        />
        <span className="text-muted-foreground flex-1">
          {m.budget_recurring_forecast_balance()}
        </span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {formatCurrency(row.balanceMinor, currency)}
        </span>
      </div>
      {row.dueMinor > 0 && (
        <div className="text-muted-foreground grid gap-0.5 leading-none">
          <span className="font-mono tabular-nums">
            {m.budget_recurring_upcoming_total({
              amount: formatCurrency(row.dueMinor, currency),
            })}
          </span>
          <span className="max-w-56 truncate">{row.dueLabels}</span>
        </div>
      )}
    </ChartTooltipCard>
  );
};

export const RecurringForecastChart = ({
  currency,
  points,
}: RecurringForecastChartProps) => {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_recurring_forecast_empty()}
      </p>
    );
  }

  const locale = getLocale();
  const config: ChartConfig = {
    [BALANCE_KEY]: {
      color: CHART_COLOR_VARS.blue,
      label: m.budget_recurring_forecast_balance(),
    },
  };

  const today = m.budget_recurring_forecast_today();
  const rows: ForecastRow[] = points.map((point, index) => ({
    balanceMinor: point.balanceMinor,
    day: index,
    dueLabels: point.labels.join(" · "),
    dueMinor: point.dueMinor,
    label:
      index === 0 ? today : point.date.toLocaleDateString(locale, DAY_TICK),
  }));

  const runsOut = rows.some((row) => row.balanceMinor < 0);
  const ticks = rows.flatMap((row) =>
    row.day % DAYS_BETWEEN_TICKS === 0 || row.day === rows.length - 1
      ? [row.day]
      : []
  );

  return (
    <figure className="h-full">
      <figcaption className="sr-only">
        {m.budget_recurring_forecast_chart_label()}
      </figcaption>
      <ChartContainer className="aspect-auto h-full w-full" config={config}>
        <AreaChart accessibilityLayer data={rows} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="day"
            interval="preserveStartEnd"
            tickFormatter={(day: number) => rows[day]?.label ?? ""}
            tickLine={false}
            tickMargin={8}
            ticks={ticks}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value, currency)}
            tickLine={false}
            width="auto"
          />
          <ChartTooltip content={<ForecastTooltip currency={currency} />} />
          {runsOut && (
            <ReferenceLine
              stroke="var(--destructive)"
              strokeDasharray="4 4"
              y={0}
            />
          )}
          <Area
            baseValue={0}
            dataKey={BALANCE_KEY}
            dot={false}
            fill={`var(--color-${BALANCE_KEY})`}
            fillOpacity={AREA_FILL_OPACITY}
            isAnimationActive={false}
            name={BALANCE_KEY}
            stroke={`var(--color-${BALANCE_KEY})`}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
    </figure>
  );
};
