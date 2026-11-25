import { Area, AreaChart } from "@freenary/ui/components/charts/area-chart";
import {
  ChartTooltip,
  TooltipContent,
} from "@freenary/ui/components/charts/tooltip";
import { XAxis } from "@freenary/ui/components/charts/x-axis";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useState } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { UnconvertedNote } from "@/shared/ui/unconverted-note";

import { useBalanceHistory } from "../model/queries";
import { RangeToggle } from "./range-toggle";
import {
  HeadlineAmount,
  WidgetCaption,
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetLoading,
} from "./widget-card";

interface NetWorthWidgetProps {
  months: number;
  title?: string;
  today: Date;
}

interface BalancePoint {
  balanceMinor: number;
  date: string;
}

interface BalanceRow extends Record<string, unknown> {
  balanceMinor: number;
  balanceText: string;
  date: Date;
  label: string;
}

const LINE_COLOR = CHART_COLOR_VARS.pink;

const AREA_FILL_OPACITY = 0.2;

const CHART_MARGIN = { bottom: 28, left: 16, right: 16, top: 8 };

const MONTH_LABEL: Intl.DateTimeFormatOptions = { month: "short" };

const DAY_LABEL: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const RANGE_OPTIONS = [6, 12] as const;

const tooltipSchema = z.object({ balanceText: z.string(), label: z.string() });

const BalanceTooltip = ({ point }: { point: unknown }) => {
  const parsed = tooltipSchema.safeParse(point);

  return parsed.success ? (
    <TooltipContent
      rows={[
        {
          color: LINE_COLOR,
          label: m.widget_net_worth_series(),
          value: parsed.data.balanceText,
        },
      ]}
      title={parsed.data.label}
    />
  ) : null;
};

const toRows = (points: BalancePoint[], currency: string): BalanceRow[] =>
  points.map((point, index) => {
    const date = new Date(`${point.date}T00:00:00`);

    return {
      balanceMinor: point.balanceMinor,
      balanceText: formatCurrency(point.balanceMinor, currency),
      date,
      label: date.toLocaleDateString(
        getLocale(),
        index === points.length - 1 ? DAY_LABEL : MONTH_LABEL
      ),
    };
  });

const BalanceChart = ({
  currency,
  months,
  points,
  unconvertedCurrencies,
}: {
  currency: string;
  months: number;
  points: BalancePoint[];
  unconvertedCurrencies: readonly string[];
}) => {
  const rows = toRows(points, currency);
  const labels = rows.map((row) => row.label);
  const first = points[0]?.balanceMinor ?? 0;
  const last = points.at(-1)?.balanceMinor ?? 0;
  const change = last - first;
  const amount = formatCurrency(Math.abs(change), currency);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <HeadlineAmount>{formatCurrency(last, currency)}</HeadlineAmount>
        <WidgetCaption tone={change >= 0 ? "positive" : "negative"}>
          {change >= 0
            ? m.widget_net_worth_up({ amount, count: months })
            : m.widget_net_worth_down({ amount, count: months })}
        </WidgetCaption>
      </div>
      <figure className="flex flex-col gap-2">
        <figcaption className="sr-only">
          {m.widget_net_worth_chart_label()}
        </figcaption>
        <AreaChart
          aspectRatio="auto"
          className="h-48 w-full"
          data={rows}
          margin={CHART_MARGIN}
        >
          <Area
            dataKey="balanceMinor"
            fill={LINE_COLOR}
            fillOpacity={AREA_FILL_OPACITY}
            stroke={LINE_COLOR}
          />
          <XAxis labels={labels} />
          <ChartTooltip
            content={BalanceTooltip}
            dateLabels={labels}
            showDatePill={false}
          />
        </AreaChart>
      </figure>
      <p className="text-muted-foreground text-xs text-pretty">
        {m.widget_net_worth_note()}
      </p>
      <UnconvertedNote counts={{}} currencies={unconvertedCurrencies} />
    </>
  );
};

export const NetWorthWidget = ({
  months,
  title,
  today,
}: NetWorthWidgetProps) => {
  const [range, setRange] = useState(months);
  const query = useBalanceHistory(today, range);
  const options = [...new Set([...RANGE_OPTIONS, months])]
    .toSorted((a, b) => a - b)
    .map((count) => ({
      label: m.widget_range_months({ count }),
      months: count,
      name: m.widget_range_months_name({ count }),
    }));

  return (
    <WidgetCard
      action={
        <RangeToggle
          label={m.widget_range_label()}
          onChange={setRange}
          options={options}
          value={range}
        />
      }
      headingLevel="h3"
      title={title ?? m.home_net_worth_title()}
    >
      {query.isPending ? (
        <WidgetLoading label={m.home_net_worth_loading()}>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-48 w-full" />
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.home_net_worth_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data?.points ? (
        <BalanceChart
          currency={query.data.currency}
          months={range}
          points={query.data.points}
          unconvertedCurrencies={query.data.unconvertedCurrencies}
        />
      ) : null}
      {query.data && query.data.points === null ? (
        <WidgetEmpty>{m.home_net_worth_empty()}</WidgetEmpty>
      ) : null}
    </WidgetCard>
  );
};
