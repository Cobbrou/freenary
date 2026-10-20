import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";

interface FixedVsVariableChartProps {
  fixed: number;
  variable: number;
}

export const FixedVsVariableChart = ({
  fixed,
  variable,
}: FixedVsVariableChartProps) => {
  const total = fixed + variable;

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_fixed_variable_empty()}
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
      label: m.budget_fixed_label(),
      value: fixed,
    },
    {
      color: CHART_COLOR_VARS.orange,
      id: "variable",
      label: m.budget_variable_label(),
      value: variable,
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
        aria-label={m.budget_fixed_variable_chart_label()}
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
              {formatCurrency(slice.value)}
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
