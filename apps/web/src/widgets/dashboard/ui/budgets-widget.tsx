import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { cn } from "@freenary/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { CategoryIcon, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { UnconvertedNote } from "@/shared/ui/unconverted-note";

import { daysLeftInMonth, plannedLines } from "../model/finance";
import type { BudgetLine } from "../model/finance";
import { useMonthBudget } from "../model/queries";
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetHint,
  WidgetLoading,
} from "./widget-card";

interface BudgetsWidgetProps {
  title?: string;
  today: Date;
}

const SKELETON_ROWS = 4;

const PERCENT = 100;

const BudgetRow = ({
  currency,
  line,
}: {
  currency: string;
  line: BudgetLine;
}) => {
  const over = line.actual > line.planned;
  const filled = Math.min(line.actual / line.planned, 1) * PERCENT;

  return (
    <li className="flex items-center gap-3">
      <CategoryIcon
        {...predefinedCategoryAppearance(line.category)}
        className="size-8 shrink-0 [&_svg]:size-4"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {categoryLabel(line.category)}
          </span>
          <span
            className={cn(
              "shrink-0 tabular-nums",
              over ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {m.widget_budget_amounts({
              planned: formatCurrency(line.planned, currency),
              spent: formatCurrency(line.actual, currency),
            })}
            {over ? (
              <span className="sr-only">
                {m.widget_budget_over({
                  amount: formatCurrency(line.actual - line.planned, currency),
                })}
              </span>
            ) : null}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full",
              over ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>
    </li>
  );
};

export const BudgetsWidget = ({ title, today }: BudgetsWidgetProps) => {
  const { query, rule } = useMonthBudget(today);
  const budget = query.data;
  const lines = budget ? plannedLines(budget.categories) : [];

  return (
    <WidgetCard
      action={
        <WidgetHint>
          {m.widget_budget_days_left({
            count: daysLeftInMonth(today, rule),
          })}
        </WidgetHint>
      }
      headingLevel="h3"
      title={title ?? m.widget_budgets_title()}
    >
      {query.isPending ? (
        <WidgetLoading label={m.widget_budgets_loading()}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div className="flex items-center gap-3" key={index}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4" />
                <Skeleton className="h-1.5 rounded-full" />
              </div>
            </div>
          ))}
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.widget_budgets_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {budget && lines.length > 0 ? (
        <div className="@container/budgets">
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 @lg/budgets:grid-cols-2">
            {lines.map((line) => (
              <BudgetRow
                currency={budget.currency}
                key={line.category}
                line={line}
              />
            ))}
          </ul>
          <UnconvertedNote
            className="pt-3"
            counts={{ transactions: budget.unconvertedCount }}
          />
        </div>
      ) : null}
      {query.data && lines.length === 0 ? (
        <WidgetEmpty>
          {m.widget_budgets_empty()}{" "}
          <Link
            className="text-foreground font-medium underline underline-offset-4"
            search={{ section: "budget" }}
            to="/settings"
          >
            {m.widget_budgets_set_up()}
          </Link>
        </WidgetEmpty>
      ) : null}
    </WidgetCard>
  );
};
