import prisma from "@freenary/db";

import { budgetMonthRuleOf } from "./budget-month";
import type { BudgetMonthRule, BudgetMonthSetting } from "./budget-month";

export const userBudgetMonthSetting = async (
  userId: string
): Promise<BudgetMonthSetting> => {
  const user = await prisma.user.findUniqueOrThrow({
    select: {
      budgetMonthAnchor: true,
      budgetMonthHolidayCountry: true,
      budgetMonthStartDay: true,
      taxCountries: true,
    },
    where: { id: userId },
  });

  return {
    anchor: user.budgetMonthAnchor,
    country: user.budgetMonthHolidayCountry ?? user.taxCountries[0] ?? null,
    startDay: user.budgetMonthStartDay,
  };
};

export const userBudgetMonthRule = async (
  userId: string
): Promise<BudgetMonthRule> =>
  budgetMonthRuleOf(await userBudgetMonthSetting(userId));
