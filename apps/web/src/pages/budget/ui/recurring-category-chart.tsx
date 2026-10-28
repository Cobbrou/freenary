import { ScrollArea } from "@freenary/ui/components/scroll-area";

import { categoryChartColor, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { RecurringCategoryRow } from "../model/recurring";

interface RecurringCategoryChartProps {
  currency: string;
  rows: RecurringCategoryRow[];
}

export const RecurringCategoryChart = ({
  currency,
  rows,
}: RecurringCategoryChartProps) => {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_recurring_categories_empty()}
      </p>
    );
  }

  const sharedScaleMinor = Math.max(...rows.map((row) => row.monthlyMinor));

  return (
    <ScrollArea className="h-full">
      <ul
        aria-label={m.budget_recurring_categories_chart_label()}
        className="flex flex-col gap-2"
      >
        {rows.map((row) => (
          <li className="flex flex-col gap-1.5 p-1" key={row.category}>
            <span className="flex items-baseline gap-2 text-xs">
              <span className="text-muted-foreground truncate">
                {categoryLabel(row.category)}
              </span>
              <span className="ms-auto shrink-0 font-mono text-[11px] tabular-nums">
                {formatCurrency(row.monthlyMinor, currency)}
              </span>
            </span>
            <span className="bg-muted relative block h-2 w-full overflow-hidden rounded-full">
              <span
                className="absolute inset-y-0 start-0 rounded-full"
                style={{
                  backgroundColor: categoryChartColor(row.category),
                  width: `${(row.monthlyMinor / sharedScaleMinor) * 100}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
};
