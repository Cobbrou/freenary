import { Skeleton } from "@freenary/ui/components/skeleton";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";

import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { AggregationMode } from "../model/period";
import { StaleRegion } from "./stale-region";

interface SummaryLabels {
  expenses: () => string;
  income: () => string;
  net: () => string;
}

interface BudgetKpiStripProps {
  aggregation: AggregationMode;
  currency: string;
  isError: boolean;
  isPending: boolean;
  isStale: boolean;
  totalExpenses: number;
  totalIncome: number;
}

const SUMMARY_LABEL_GETTERS = {
  average: {
    expenses: m.budget_summary_expenses_average,
    income: m.budget_summary_income_average,
    net: m.budget_summary_net_average,
  },
  median: {
    expenses: m.budget_summary_expenses_median,
    income: m.budget_summary_income_median,
    net: m.budget_summary_net_median,
  },
  total: {
    expenses: m.budget_summary_expenses_total,
    income: m.budget_summary_income_total,
    net: m.budget_summary_net_total,
  },
} satisfies Record<AggregationMode, SummaryLabels>;

const STRIP_LAYOUT = "grid grid-cols-1 gap-4 @md/budget:grid-cols-3";

const CELL_CONTROL_HEIGHTS = 2;

const KpiCell = ({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: string;
  value: string | null;
}) => {
  const { controlHeight } = useSize();

  return (
    <div
      className="flex flex-col gap-1"
      style={{ height: controlHeight * CELL_CONTROL_HEIGHTS }}
    >
      {value === null ? (
        <span className="text-muted-foreground text-2xl font-semibold">
          <span aria-hidden="true">—</span>
          <span className="sr-only">{m.budget_summary_unavailable()}</span>
        </span>
      ) : (
        <span className={cn("text-2xl font-semibold tabular-nums", tone)}>
          {value}
        </span>
      )}
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
};

export const BudgetKpiStrip = ({
  aggregation,
  currency,
  isError,
  isPending,
  isStale,
  totalExpenses,
  totalIncome,
}: BudgetKpiStripProps) => {
  const { controlHeight } = useSize();
  const labels = SUMMARY_LABEL_GETTERS[aggregation];

  if (isPending) {
    const cellHeight = controlHeight * CELL_CONTROL_HEIGHTS;

    return (
      <div aria-busy="true" className={STRIP_LAYOUT}>
        <output className="sr-only">{m.budget_summary_loading()}</output>
        <Skeleton aria-hidden="true" style={{ height: cellHeight }} />
        <Skeleton aria-hidden="true" style={{ height: cellHeight }} />
        <Skeleton aria-hidden="true" style={{ height: cellHeight }} />
      </div>
    );
  }

  const net = totalIncome - totalExpenses;
  const shown = (amount: number) =>
    isError ? null : formatCurrency(amount, currency);

  return (
    <StaleRegion className={STRIP_LAYOUT} isStale={isStale}>
      <KpiCell label={labels.income()} value={shown(totalIncome)} />
      <KpiCell label={labels.expenses()} value={shown(totalExpenses)} />
      <KpiCell
        label={labels.net()}
        tone={net >= 0 ? "text-success" : "text-destructive"}
        value={shown(net)}
      />
    </StaleRegion>
  );
};
