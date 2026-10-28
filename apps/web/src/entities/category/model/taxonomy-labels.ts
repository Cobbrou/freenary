import {
  isCategoryGroup,
  isSpendingCategory,
} from "@freenary/api/lib/taxonomy";
import type {
  CategoryGroup,
  SpendingCategory,
} from "@freenary/api/lib/taxonomy";

import { m } from "@/paraglide/messages.js";

const GROUP_MESSAGES = {
  income: m.category_group_income,
  investments: m.category_group_investments,
  spending: m.category_group_spending,
} satisfies Record<CategoryGroup, () => string>;

const CATEGORY_MESSAGES = {
  benefits: m.category_benefits,
  "bills-utilities": m.category_bills_utilities,
  "car-fuel": m.category_car_fuel,
  "cash-withdrawal": m.category_cash_withdrawal,
  crypto: m.category_crypto,
  entertainment: m.category_entertainment,
  "family-education": m.category_family_education,
  groceries: m.category_groceries,
  health: m.category_health,
  "investment-income": m.category_investment_income,
  "loans-bank-fees": m.category_loans_bank_fees,
  "other-income": m.category_other_income,
  people: m.category_people,
  refunds: m.category_refunds,
  "rent-mortgage": m.category_rent_mortgage,
  "rental-income": m.category_rental_income,
  restaurants: m.category_restaurants,
  retirement: m.category_retirement,
  salary: m.category_salary,
  savings: m.category_savings,
  securities: m.category_securities,
  "self-employment": m.category_self_employment,
  shopping: m.category_shopping,
  subscriptions: m.category_subscriptions,
  taxes: m.category_taxes,
  "transport-travel": m.category_transport_travel,
  uncategorised: m.category_uncategorised,
} satisfies Record<SpendingCategory, () => string>;

export const categoryGroupLabel = (group: CategoryGroup): string =>
  GROUP_MESSAGES[group]();

export const categoryLabel = (category: SpendingCategory): string =>
  CATEGORY_MESSAGES[category]();

export const categoryEntryLabel = (entry: {
  isCustom: boolean;
  key: string;
  label?: string;
}): string => {
  if (entry.isCustom) {
    return entry.label ?? entry.key;
  }

  if (isCategoryGroup(entry.key)) {
    return categoryGroupLabel(entry.key);
  }

  if (isSpendingCategory(entry.key)) {
    return categoryLabel(entry.key);
  }

  return entry.label ?? entry.key;
};
