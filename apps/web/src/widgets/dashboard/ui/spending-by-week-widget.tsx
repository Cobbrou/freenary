import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { Bar } from "@freenary/ui/components/charts/bar";
import { BarChart } from "@freenary/ui/components/charts/bar-chart";
import { BarXAxis } from "@freenary/ui/components/charts/bar-x-axis";
import { ChartTooltip } from "@freenary/ui/components/charts/tooltip";
import type { TooltipRow } from "@freenary/ui/components/charts/tooltip";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { z } from "zod";

import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";

import { STACKED_CATEGORIES_SHOWN, stackedWeeks } from "../model/finance";
import type { StackedWeeks } from "../model/finance";
import { useSpendingByWeek } from "../model/queries";
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetHint,
  WidgetLoading,
} from "./widget-card";

interface SpendingByWeekWidgetProps {
  title?: string;
  today: Date;
  weeks: number;
}

interface WeekRow extends Record<string, unknown> {
  label: string;
  tooltipRows: TooltipRow[];
}

const OTHER_KEY = "other";

const OTHER_COLOR = CHART_COLOR_VARS.grey;

const CHART_MARGIN = { bottom: 28, left: 8, right: 8, top: 8 };

const WEEK_LABEL: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const tooltipSchema = z.object({
  tooltipRows: z.array(
    z.object({ color: z.string(), label: z.string(), value: z.string() })
  ),
});

const weekStart = (iso: string): Date => new Date(`${iso}T00:00:00`);

const toRows = (
  { categories, weeks }: StackedWeeks,
  currency: string
): WeekRow[] =>
  weeks.map((week) => ({
    label: weekStart(week.start).toLocaleDateString(getLocale(), WEEK_LABEL),
    [OTHER_KEY]: week.otherMinor,
    tooltipRows: [
      ...categories.flatMap((category) => {
        const amount = week.amounts[category] ?? 0;

        return amount > 0
          ? [
              {
                color: categoryChartColor(category),
                label: categoryLabel(category),
                value: formatCurrency(amount, currency),
              },
            ]
          : [];
      }),
      ...(week.otherMinor > 0
        ? [
            {
              color: OTHER_COLOR,
              label: m.widget_spending_other(),
              value: formatCurrency(week.otherMinor, currency),
            },
          ]
        : []),
      {
        color: "transparent",
        label: m.widget_spending_week_total(),
        value: formatCurrency(week.totalMinor, currency),
      },
    ],
    ...Object.fromEntries(
      categories.map((category) => [category, week.amounts[category] ?? 0])
    ),
  }));

const Legend = ({
  categories,
  hasOther,
}: {
  categories: SpendingCategory[];
  hasOther: boolean;
}) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {categories.map((category) => (
      <li
        className="text-muted-foreground flex items-center gap-1.5 text-xs"
        key={category}
      >
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: categoryChartColor(category) }}
        />
        {categoryLabel(category)}
      </li>
    ))}
    {hasOther ? (
      <li className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: OTHER_COLOR }}
        />
        {m.widget_spending_other()}
      </li>
    ) : null}
  </ul>
);

const WeeksChart = ({
  currency,
  stacked,
}: {
  currency: string;
  stacked: StackedWeeks;
}) => {
  const hasOther = stacked.weeks.some((week) => week.otherMinor > 0);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">
        {m.widget_spending_chart_label()}
      </figcaption>
      <BarChart
        aspectRatio="auto"
        className="h-48 w-full"
        data={toRows(stacked, currency)}
        margin={CHART_MARGIN}
        stacked
        xDataKey="label"
      >
        {stacked.categories.map((category) => (
          <Bar
            dataKey={category}
            fill={categoryChartColor(category)}
            key={category}
          />
        ))}
        {hasOther ? <Bar dataKey={OTHER_KEY} fill={OTHER_COLOR} /> : null}
        <BarXAxis />
        <ChartTooltip
          rows={(point) =>
            tooltipSchema.safeParse(point).data?.tooltipRows ?? []
          }
          showDatePill={false}
        />
      </BarChart>
      <Legend categories={stacked.categories} hasOther={hasOther} />
    </figure>
  );
};

export const SpendingByWeekWidget = ({
  title,
  today,
  weeks,
}: SpendingByWeekWidgetProps) => {
  const query = useSpendingByWeek(today, weeks);
  const stacked = query.data
    ? stackedWeeks(query.data.weeks, STACKED_CATEGORIES_SHOWN)
    : undefined;

  const spent = stacked?.weeks.some((week) => week.totalMinor > 0) ?? false;

  return (
    <WidgetCard
      action={<WidgetHint>{m.widget_last_weeks({ count: weeks })}</WidgetHint>}
      headingLevel="h3"
      title={title ?? m.widget_spending_by_week_title()}
    >
      {query.isPending ? (
        <WidgetLoading label={m.widget_spending_loading()}>
          <Skeleton className="h-48 w-full" />
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.widget_spending_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data && stacked && spent ? (
        <WeeksChart currency={query.data.currency} stacked={stacked} />
      ) : null}
      {query.data && !spent ? (
        <WidgetEmpty>{m.widget_spending_empty()}</WidgetEmpty>
      ) : null}
    </WidgetCard>
  );
};
