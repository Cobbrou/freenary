import { Bar } from "@freenary/ui/components/charts/bar";
import { BarChart } from "@freenary/ui/components/charts/bar-chart";
import { BarXAxis } from "@freenary/ui/components/charts/bar-x-axis";
import { ChartTooltip } from "@freenary/ui/components/charts/tooltip";
import type { TooltipRow } from "@freenary/ui/components/charts/tooltip";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useState } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { CashFlow } from "../model/finance";
import { useMonthlyCashFlow } from "../model/queries";
import { RangeToggle } from "./range-toggle";
import {
  WidgetCaption,
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetLoading,
} from "./widget-card";

interface IncomeVsSpendingWidgetProps {
  months: number;
  title?: string;
  today: Date;
}

interface MonthRow extends Record<string, unknown> {
  incoming: number;
  label: string;
  outgoing: number;
  tooltipRows: TooltipRow[];
}

const IN_COLOR = CHART_COLOR_VARS.green;

const OUT_COLOR = CHART_COLOR_VARS.red;

const CHART_MARGIN = { bottom: 28, left: 8, right: 8, top: 8 };

const MONTH_LABEL: Intl.DateTimeFormatOptions = { month: "short" };

const RANGE_OPTIONS = [3, 6, 12] as const;

const tooltipSchema = z.object({
  tooltipRows: z.array(
    z.object({ color: z.string(), label: z.string(), value: z.string() })
  ),
});

const monthOf = (label: string): Date => new Date(`${label}-01T00:00:00`);

const toRows = ({ currency, periods }: CashFlow): MonthRow[] =>
  periods.map((period) => ({
    incoming: period.incoming,
    label: monthOf(period.label).toLocaleDateString(getLocale(), MONTH_LABEL),
    outgoing: period.outgoing,
    tooltipRows: [
      {
        color: IN_COLOR,
        label: m.widget_money_in(),
        value: formatCurrency(period.incoming, currency),
      },
      {
        color: OUT_COLOR,
        label: m.widget_money_out(),
        value: formatCurrency(period.outgoing, currency),
      },
    ],
  }));

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <li className="text-muted-foreground flex items-center gap-1.5 text-xs">
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
    {label}
  </li>
);

const MonthsChart = ({ cashFlow }: { cashFlow: CashFlow }) => {
  const savedMinor = cashFlow.periods.reduce(
    (total, period) => total + period.incoming - period.outgoing,
    0
  );

  const amount = formatCurrency(Math.abs(savedMinor), cashFlow.currency);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">
        {m.widget_income_chart_label()}
      </figcaption>
      <BarChart
        aspectRatio="auto"
        className="h-44 w-full"
        data={toRows(cashFlow)}
        margin={CHART_MARGIN}
        xDataKey="label"
      >
        <Bar dataKey="incoming" fill={IN_COLOR} />
        <Bar dataKey="outgoing" fill={OUT_COLOR} />
        <BarXAxis />
        <ChartTooltip
          rows={(point) =>
            tooltipSchema.safeParse(point).data?.tooltipRows ?? []
          }
          showDatePill={false}
        />
      </BarChart>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex items-center gap-4">
          <LegendDot color={IN_COLOR} label={m.widget_money_in()} />
          <LegendDot color={OUT_COLOR} label={m.widget_money_out()} />
        </ul>
        <WidgetCaption tone={savedMinor >= 0 ? "positive" : "negative"}>
          {savedMinor >= 0
            ? m.widget_income_saved({ amount })
            : m.widget_income_overspent({ amount })}
        </WidgetCaption>
      </div>
    </figure>
  );
};

export const IncomeVsSpendingWidget = ({
  months,
  title,
  today,
}: IncomeVsSpendingWidgetProps) => {
  const [range, setRange] = useState(months);
  const query = useMonthlyCashFlow(today, range);
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
      title={title ?? m.widget_income_title()}
    >
      {query.isPending ? (
        <WidgetLoading label={m.widget_income_loading()}>
          <Skeleton className="h-44 w-full" />
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.widget_income_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data && query.data.periods.length > 0 ? (
        <MonthsChart cashFlow={query.data} />
      ) : null}
      {query.data?.periods.length === 0 ? (
        <WidgetEmpty>{m.widget_income_empty()}</WidgetEmpty>
      ) : null}
    </WidgetCard>
  );
};
