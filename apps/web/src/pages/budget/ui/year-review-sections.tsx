import { Area, AreaChart } from "@freenary/ui/components/charts/area-chart";
import { Bar } from "@freenary/ui/components/charts/bar";
import { BarChart } from "@freenary/ui/components/charts/bar-chart";
import { BarXAxis } from "@freenary/ui/components/charts/bar-x-axis";
import { ChartTooltip } from "@freenary/ui/components/charts/tooltip";
import { XAxis } from "@freenary/ui/components/charts/x-axis";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";
import { motion } from "motion/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { readableName } from "@/shared/lib/text";
import { PRESS_MOTION } from "@/shared/ui/list-controls";
import { UnconvertedNote } from "@/shared/ui/unconverted-note";

import {
  changeOf,
  merchantKeyName,
  netWorthChangeOf,
} from "../model/year-review";
import type { MerchantYear, YearReview } from "../model/year-review";
import { RankedBarChart } from "./ranked-bar-chart";
import type { RankedBar } from "./ranked-bar-chart";
import { formatChange, monthLabel } from "./year-review-format";

const IN_COLOR = CHART_COLOR_VARS.green;

const OUT_COLOR = CHART_COLOR_VARS.red;

const NET_WORTH_COLOR = CHART_COLOR_VARS.pink;

const MERCHANT_COLOR = CHART_COLOR_VARS.blue;

const AREA_FILL_OPACITY = 0.2;

const CHART_MARGIN = { bottom: 28, left: 8, right: 8, top: 8 };

const CATEGORIES_SHOWN = 8;

const MONTH_LABELS = { base: 6, sm: 12 };

const RANKED_BODY = "h-[300px]";

const tooltipSchema = z.object({
  tooltipRows: z.array(
    z.object({ color: z.string(), label: z.string(), value: z.string() })
  ),
});

export const ReviewCard = ({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) => (
  <section className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const EmptyList = () => (
  <p className="text-muted-foreground flex h-full items-center justify-center px-4 py-8 text-center text-xs">
    {m.year_review_empty_list()}
  </p>
);

export const MonthsSection = ({ review }: { review: YearReview }) => {
  const rows = review.months.map((month) => ({
    incoming: month.incomingMinor,
    label: monthLabel(month.month, "short"),
    outgoing: month.outgoingMinor,
    tooltipRows: [
      {
        color: IN_COLOR,
        label: m.widget_money_in(),
        value: formatCurrency(month.incomingMinor, review.currency),
      },
      {
        color: OUT_COLOR,
        label: m.widget_money_out(),
        value: formatCurrency(month.outgoingMinor, review.currency),
      },
    ],
  }));

  return (
    <ReviewCard title={m.year_review_months_title()}>
      <figure>
        <figcaption className="sr-only">
          {m.year_review_months_chart_label()}
        </figcaption>
        <BarChart
          aspectRatio="auto"
          className="h-56 w-full"
          data={rows}
          margin={CHART_MARGIN}
          xDataKey="label"
        >
          <Bar dataKey="incoming" fill={IN_COLOR} />
          <Bar dataKey="outgoing" fill={OUT_COLOR} />
          <BarXAxis maxLabels={MONTH_LABELS} />
          <ChartTooltip
            rows={(point) =>
              tooltipSchema.safeParse(point).data?.tooltipRows ?? []
            }
            showDatePill={false}
          />
        </BarChart>
      </figure>
    </ReviewCard>
  );
};

export const CategoriesSection = ({ review }: { review: YearReview }) => {
  const previousYear = String(review.year - 1);
  const bars = review.categories
    .slice(0, CATEGORIES_SHOWN)
    .map((entry): RankedBar => {
      const color = categoryChartColor(entry.category);
      const change =
        review.previous === null
          ? null
          : changeOf(entry.amountMinor, entry.previousAmountMinor);

      return {
        color,
        label: categoryLabel(entry.category),
        tooltipRows: [
          {
            color,
            label: String(review.year),
            value: formatCurrency(entry.amountMinor, review.currency),
          },
          ...(review.previous === null
            ? []
            : [
                {
                  color: CHART_COLOR_VARS.grey,
                  label: previousYear,
                  value: formatCurrency(
                    entry.previousAmountMinor,
                    review.currency
                  ),
                },
              ]),
        ],
        value: entry.amountMinor,
        valueLabel:
          change === null
            ? formatCurrency(entry.amountMinor, review.currency)
            : formatChange(change),
      };
    });

  return (
    <ReviewCard title={m.year_review_categories_title()}>
      <div className={RANKED_BODY}>
        {bars.length === 0 ? (
          <EmptyList />
        ) : (
          <RankedBarChart
            bars={bars}
            label={m.year_review_categories_chart_label()}
          />
        )}
      </div>
    </ReviewCard>
  );
};

type MerchantRanking = "amount" | "count";

const merchantBar = (
  merchant: MerchantYear,
  ranking: MerchantRanking,
  currency: string
): RankedBar => {
  const amount = formatCurrency(merchant.totalMinor, currency);
  const payments = m.year_review_payments({ count: merchant.count });

  return {
    color: MERCHANT_COLOR,
    label: readableName(merchantKeyName(merchant)),
    tooltipRows: [
      {
        color: MERCHANT_COLOR,
        label: m.year_review_merchants_by_amount(),
        value: amount,
      },
      {
        color: MERCHANT_COLOR,
        label: m.year_review_merchants_by_count(),
        value: payments,
      },
    ],
    value: ranking === "amount" ? merchant.totalMinor : merchant.count,
    valueLabel: ranking === "amount" ? amount : payments,
  };
};

export const MerchantsSection = ({ review }: { review: YearReview }) => {
  const [ranking, setRanking] = useState<MerchantRanking>("amount");
  const merchants =
    ranking === "amount" ? review.merchants.byAmount : review.merchants.byCount;

  return (
    <ReviewCard
      action={
        <ToggleGroup
          aria-label={m.year_review_merchants_switch_label()}
          onValueChange={([next]) => {
            if (next === "amount" || next === "count") {
              setRanking(next);
            }
          }}
          size="sm"
          spacing={0}
          value={[ranking]}
          variant="outline"
        >
          <ToggleGroupItem
            render={<motion.button {...PRESS_MOTION} />}
            value="amount"
          >
            {m.year_review_merchants_by_amount()}
          </ToggleGroupItem>
          <ToggleGroupItem
            render={<motion.button {...PRESS_MOTION} />}
            value="count"
          >
            {m.year_review_merchants_by_count()}
          </ToggleGroupItem>
        </ToggleGroup>
      }
      title={m.year_review_merchants_title()}
    >
      <div className={RANKED_BODY}>
        {merchants.length === 0 ? (
          <EmptyList />
        ) : (
          <RankedBarChart
            bars={merchants.map((merchant) =>
              merchantBar(merchant, ranking, review.currency)
            )}
            label={m.year_review_merchants_chart_label()}
          />
        )}
      </div>
    </ReviewCard>
  );
};

export const RecurringSection = ({ review }: { review: YearReview }) => {
  const { items, merchantCount, totalMinor } = review.recurring;

  return (
    <ReviewCard title={m.year_review_recurring_title()}>
      <p className="text-2xl font-semibold tabular-nums">
        {formatCurrency(totalMinor, review.currency)}
      </p>
      <p className="text-muted-foreground text-sm">
        {m.year_review_recurring_total({ count: merchantCount })}
      </p>
      {items.length === 0 ? (
        <EmptyList />
      ) : (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-3 py-2 text-sm"
              key={item.merchantKey}
            >
              <span className="min-w-0 truncate">
                {readableName(merchantKeyName(item))}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatCurrency(item.totalMinor, review.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ReviewCard>
  );
};

const NET_WORTH_LABEL: Intl.DateTimeFormatOptions = { month: "short" };

export const NetWorthSection = ({ review }: { review: YearReview }) => {
  const { points, unconvertedCurrencies } = review.netWorth;
  const change = netWorthChangeOf(points);

  if (!change) {
    return (
      <ReviewCard title={m.year_review_net_worth_title()}>
        <EmptyList />
      </ReviewCard>
    );
  }

  const rows = points.map((point) => {
    const date = new Date(`${point.date}T00:00:00`);

    return {
      balanceMinor: point.balanceMinor,
      date,
      label: date.toLocaleDateString(getLocale(), NET_WORTH_LABEL),
    };
  });

  const amount = formatCurrency(Math.abs(change.changeMinor), review.currency);

  return (
    <ReviewCard title={m.year_review_net_worth_title()}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(change.endMinor, review.currency)}
        </p>
        <p
          className={
            change.changeMinor >= 0
              ? "text-success text-sm"
              : "text-destructive text-sm"
          }
        >
          {change.changeMinor >= 0
            ? m.year_review_net_worth_up({ amount })
            : m.year_review_net_worth_down({ amount })}
        </p>
      </div>
      <figure>
        <figcaption className="sr-only">
          {m.year_review_net_worth_chart_label()}
        </figcaption>
        <AreaChart
          aspectRatio="auto"
          className="h-44 w-full"
          data={rows}
          margin={CHART_MARGIN}
        >
          <Area
            dataKey="balanceMinor"
            fill={NET_WORTH_COLOR}
            fillOpacity={AREA_FILL_OPACITY}
            stroke={NET_WORTH_COLOR}
          />
          <XAxis labels={rows.map((row) => row.label)} />
        </AreaChart>
      </figure>
      <UnconvertedNote counts={{}} currencies={unconvertedCurrencies} />
    </ReviewCard>
  );
};
