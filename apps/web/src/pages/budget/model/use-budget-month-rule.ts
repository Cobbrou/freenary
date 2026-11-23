import { budgetMonthRuleOf } from "@freenary/api/lib/budget-month";
import type { BudgetMonthRule } from "@freenary/api/lib/budget-month";
import { useSuspenseQuery } from "@tanstack/react-query";

import { budgetMonthQueryOptions } from "@/entities/budget";

export const useBudgetMonthRule = (): BudgetMonthRule =>
  budgetMonthRuleOf(useSuspenseQuery(budgetMonthQueryOptions()).data);
