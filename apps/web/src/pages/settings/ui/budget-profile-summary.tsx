import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

interface BudgetProfileSummaryProps {
  currency: string;
  totalAllocated: number;
  totalRevenue: number;
}

export const BudgetProfileSummary = ({
  currency,
  totalAllocated,
  totalRevenue,
}: BudgetProfileSummaryProps) => {
  const remaining = totalRevenue - totalAllocated;

  return (
    <div className="flex justify-between font-mono text-[11px]">
      <span className="text-muted-foreground">
        {m.settings_summary_revenues()}{" "}
        <span className="text-foreground">
          {formatCurrency(totalRevenue, currency)}
        </span>
      </span>
      <span className="text-muted-foreground">
        {m.settings_summary_allocated()}{" "}
        <span className="text-foreground">
          {formatCurrency(totalAllocated, currency)}
        </span>
      </span>
      <span className="text-muted-foreground">
        {remaining >= 0
          ? m.settings_summary_money_left()
          : m.settings_summary_over_allocated()}{" "}
        <span className={remaining >= 0 ? "text-success" : "text-destructive"}>
          {formatCurrency(Math.abs(remaining), currency)}
        </span>
      </span>
    </div>
  );
};
