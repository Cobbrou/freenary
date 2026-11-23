import {
  budgetMonthRuleOf,
  CALENDAR_BUDGET_MONTH,
} from "@freenary/api/lib/budget-month";
import type { BudgetMonthRule } from "@freenary/api/lib/budget-month";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api";

export const budgetMonthQueryOptions = () =>
  orpc.settings.getBudgetMonth.queryOptions();

export const useBudgetMonthRule = (): BudgetMonthRule | undefined => {
  const query = useQuery(budgetMonthQueryOptions());

  if (query.data) {
    return budgetMonthRuleOf(query.data);
  }

  return query.isError ? CALENDAR_BUDGET_MONTH : undefined;
};
