import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { SpendSplit } from "../model/recurring";

interface RecurringSplitChartProps {
  currency: string;
  split: SpendSplit;
}

export const RecurringSplitChart = ({
  currency,
  split,
}: RecurringSplitChartProps) => {
  const total =
    split.fixedMinor + split.behavioralMinor + split.discretionaryMinor;

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_recurring_split_empty()}
      </p>
    );
  }

  const share = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 0,
    style: "percent",
  });

  const slices = [
    {
      color: CHART_COLOR_VARS.blue,
      id: "fixed",
      label: m.budget_recurring_series_fixed(),
      value: split.fixedMinor,
    },
    {
      color: CHART_COLOR_VARS.orange,
      id: "behavioral",
      label: m.budget_recurring_series_behavioral(),
      value: split.behavioralMinor,
    },
    {
      color: CHART_COLOR_VARS.grey,
      id: "discretionary",
      label: m.budget_recurring_series_discretionary(),
      value: split.discretionaryMinor,
    },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div
        aria-hidden="true"
        className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
      >
        {slices.map((slice) => (
          <div
            key={slice.id}
            style={{
              backgroundColor: slice.color,
              width: `${(slice.value / total) * 100}%`,
            }}
          />
        ))}
      </div>
      <ul
        aria-label={m.budget_recurring_split_chart_label()}
        className="flex flex-col gap-2"
      >
        {slices.map((slice) => (
          <li className="flex items-center gap-2 text-xs" key={slice.id}>
            <span
              className="size-2 shrink-0 rounded-[1px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-muted-foreground truncate">
              {slice.label}
            </span>
            <span className="ms-auto shrink-0 font-mono tabular-nums">
              {formatCurrency(slice.value, currency)}
            </span>
            <span className="text-muted-foreground min-w-9 shrink-0 text-end font-mono tabular-nums">
              {share.format(slice.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
