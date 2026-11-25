import { groupOfCategoryRef } from "./budget-planned";
import type { CategoryRef } from "./budget-planned";
import { resolveCategoryGroup } from "./taxonomy";
import type { CategoryGroup } from "./taxonomy";

export type BudgetLineKind = "INVESTMENT" | "OUTGOING" | "REVENUE";

export const MAX_AMOUNT_MINOR_UNITS = 999_999_999_999_999;

export const MAX_BUDGET_LINE_LABEL_LENGTH = 60;

export const MAX_BUDGET_LINES = 200;

const KIND_BY_GROUP = {
  income: "REVENUE",
  investments: "INVESTMENT",
  spending: "OUTGOING",
} as const satisfies Record<CategoryGroup, BudgetLineKind>;

const KIND_OF_A_LINE_WITHOUT_A_GROUP = "OUTGOING" satisfies BudgetLineKind;

export const budgetLineKindOfGroup = (
  groupKey: string | null
): BudgetLineKind => {
  const group = groupKey ? resolveCategoryGroup(groupKey) : null;

  return group ? KIND_BY_GROUP[group] : KIND_OF_A_LINE_WITHOUT_A_GROUP;
};

export const budgetLineKindOf = (ref: CategoryRef): BudgetLineKind =>
  budgetLineKindOfGroup(groupOfCategoryRef(ref));
