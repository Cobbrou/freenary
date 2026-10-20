import { ASSISTANT_UI } from "@freenary/api/assistant/ui";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@freenary/ui/components/chart";
import type { ChartConfig } from "@freenary/ui/components/chart";
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import type { LibraryDefinition } from "@openuidev/react-lang";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatDecimalCurrency } from "@/shared/lib/format-currency";
import { ChartTooltipCard } from "@/shared/ui/chart-tooltip";

interface Series {
  name: string;
  values: number[];
}

interface TooltipItem {
  color?: string;
  dataKey?: string | number;
  payload?: { fill?: string; label?: string; value?: number };
  value?: number | null;
}

const PALETTE = [
  CHART_COLOR_VARS.blue,
  CHART_COLOR_VARS.orange,
  CHART_COLOR_VARS.green,
  CHART_COLOR_VARS.purple,
  CHART_COLOR_VARS.pink,
  CHART_COLOR_VARS.red,
  CHART_COLOR_VARS.grey,
];

const DEFAULT_CURRENCY = "EUR";
const ISO_CURRENCY_CODE = /^[A-Z]{3}$/u;

const currencyOf = (code: string | undefined): string =>
  code !== undefined && ISO_CURRENCY_CODE.test(code) ? code : DEFAULT_CURRENCY;

const CHART_HEIGHT_CLASS = "aspect-auto h-56 w-full";

const seriesKey = (index: number): string => `s${index}`;

const toRowsWithGaps = (labels: string[], series: Series[]) =>
  labels.map((label, index) => ({
    label,
    ...Object.fromEntries(
      series.map((entry, seriesIndex) => [
        seriesKey(seriesIndex),
        entry.values[index] ?? null,
      ])
    ),
  }));

const seriesConfig = (series: Series[]): ChartConfig =>
  Object.fromEntries(
    series.map((entry, index) => [
      seriesKey(index),
      { color: PALETTE[index % PALETTE.length], label: entry.name },
    ])
  );

const compactCurrency = (value: number, currency: string): string =>
  new Intl.NumberFormat(getLocale(), {
    currency,
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);

const SeriesTooltip = ({
  active,
  config,
  currency,
  label,
  payload,
}: {
  active?: boolean;
  config: ChartConfig;
  currency: string;
  label?: string;
  payload?: TooltipItem[];
}) => {
  if (!(active && payload?.length)) {
    return null;
  }

  return (
    <ChartTooltipCard className="min-w-32">
      {label && <div className="font-medium">{label}</div>}
      {payload.map((item) => {
        const key = String(item.dataKey);

        if (item.value === undefined || item.value === null) {
          return null;
        }

        return (
          <div
            className="flex items-center justify-between gap-3 leading-none"
            key={key}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">
                {config[key]?.label}
              </span>
            </span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {formatDecimalCurrency(item.value, currency)}
            </span>
          </div>
        );
      })}
    </ChartTooltipCard>
  );
};

const SliceTooltip = ({
  active,
  currency,
  payload,
  total,
}: {
  active?: boolean;
  currency: string;
  payload?: TooltipItem[];
  total: number;
}) => {
  const slice = active ? payload?.[0]?.payload : undefined;

  if (!slice || slice.value === undefined) {
    return null;
  }

  const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;

  return (
    <ChartTooltipCard className="min-w-32">
      <div className="flex items-center justify-between gap-3 leading-none">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: slice.fill }}
          />
          <span className="text-muted-foreground">{slice.label}</span>
        </span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {formatDecimalCurrency(slice.value, currency)} ({share}%)
        </span>
      </div>
    </ChartTooltipCard>
  );
};

const Stat = defineComponent({
  ...ASSISTANT_UI.Stat,
  component: ({ props }) => (
    <div className="flex min-w-32 flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{props.label}</span>
      <span className="font-mono text-lg tabular-nums">
        {formatDecimalCurrency(props.value, currencyOf(props.currency))}
      </span>
    </div>
  ),
});

const AssistantBarChart = defineComponent({
  ...ASSISTANT_UI.BarChart,
  component: ({ props }) => {
    const currency = currencyOf(props.currency);
    const config = seriesConfig(props.series);

    return (
      <ChartContainer className={CHART_HEIGHT_CLASS} config={config}>
        <BarChart
          accessibilityLayer
          data={toRowsWithGaps(props.labels, props.series)}
        >
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="label" tickLine={false} />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => compactCurrency(value, currency)}
            tickLine={false}
            width={56}
          />
          <ChartTooltip
            content={<SeriesTooltip config={config} currency={currency} />}
            cursor={false}
          />
          {props.series.length > 1 && (
            <ChartLegend content={<ChartLegendContent />} />
          )}
          {props.series.map((_entry, index) => (
            <Bar
              dataKey={seriesKey(index)}
              fill={`var(--color-${seriesKey(index)})`}
              key={seriesKey(index)}
              maxBarSize={48}
              radius={4}
            />
          ))}
        </BarChart>
      </ChartContainer>
    );
  },
});

const AssistantLineChart = defineComponent({
  ...ASSISTANT_UI.LineChart,
  component: ({ props }) => {
    const currency = currencyOf(props.currency);
    const config = seriesConfig(props.series);

    return (
      <ChartContainer className={CHART_HEIGHT_CLASS} config={config}>
        <LineChart
          accessibilityLayer
          data={toRowsWithGaps(props.labels, props.series)}
        >
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="label" tickLine={false} />
          <YAxis
            axisLine={false}
            tickFormatter={(value: number) => compactCurrency(value, currency)}
            tickLine={false}
            width={56}
          />
          <ChartTooltip
            content={<SeriesTooltip config={config} currency={currency} />}
          />
          {props.series.length > 1 && (
            <ChartLegend content={<ChartLegendContent />} />
          )}
          {props.series.map((_entry, index) => (
            <Line
              dataKey={seriesKey(index)}
              dot={false}
              key={seriesKey(index)}
              stroke={`var(--color-${seriesKey(index)})`}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ChartContainer>
    );
  },
});

const AssistantDonutChart = defineComponent({
  ...ASSISTANT_UI.DonutChart,
  component: ({ props }) => {
    const currency = currencyOf(props.currency);
    const slices = props.labels.flatMap((label, index) => {
      const value = props.values[index];

      return value === undefined
        ? []
        : [
            {
              fill: PALETTE[index % PALETTE.length] ?? CHART_COLOR_VARS.grey,
              key: seriesKey(index),
              label,
              value,
            },
          ];
    });

    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    const config: ChartConfig = Object.fromEntries(
      slices.map((slice) => [slice.key, { label: slice.label }])
    );

    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-10">
        <ChartContainer
          className="aspect-square h-40 w-40 shrink-0"
          config={config}
        >
          <PieChart>
            <ChartTooltip
              content={<SliceTooltip currency={currency} total={total} />}
            />
            <Pie
              data={slices}
              dataKey="value"
              innerRadius="55%"
              nameKey="label"
              outerRadius="100%"
            >
              {slices.map((slice) => (
                <Cell fill={slice.fill} key={slice.key} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 sm:flex-col">
          {slices.map((slice) => (
            <li
              className="flex items-center gap-1.5 font-mono text-[11px]"
              key={slice.key}
            >
              <span
                className="size-2 rounded-[1px]"
                style={{ backgroundColor: slice.fill }}
              />
              <span className="text-muted-foreground">{slice.label}</span>
              <span>{formatDecimalCurrency(slice.value, currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  },
});

const Card = defineComponent({
  ...ASSISTANT_UI.Card,
  component: ({ props, renderNode }) => {
    const stats = props.children.filter((child) => child.typeName === "Stat");
    const charts = props.children.filter((child) => child.typeName !== "Stat");

    return (
      <section className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-4">
        <h3 className="text-sm font-medium">{props.title}</h3>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {renderNode(stats)}
          </div>
        )}
        {renderNode(charts)}
      </section>
    );
  },
});

const components = {
  BarChart: AssistantBarChart,
  Card,
  DonutChart: AssistantDonutChart,
  LineChart: AssistantLineChart,
  Stat,
} satisfies Record<
  keyof typeof ASSISTANT_UI,
  LibraryDefinition["components"][number]
>;

export const assistantUiLibrary = createLibrary({
  components: Object.values(components),
  root: "Card",
});
