import { SAVING_CATEGORIES } from "./account-types";
import type { BalancePoint } from "./balance-history";
import {
  budgetMonthKey,
  budgetMonthKeysBetween,
  budgetMonthOfBankDate,
  budgetMonthsRange,
} from "./budget-month";
import type { BudgetMonthRange, BudgetMonthRule } from "./budget-month";
import type { SpendingCategory } from "./taxonomy";
import { effectiveCategory } from "./transaction-category";

export interface YearRow {
  amount: number;
  category: string | null;
  counterpartyName: string | null;
  date: Date;
  merchantKey: string | null;
  resolvedCategory: string | null;
}

export interface MerchantYear {
  count: number;
  merchantKey: string;
  merchantName: string | null;
  totalMinor: number;
}

const DECEMBER = 11;

const REVIEW_OPENING_DAY = 15;

const MONTHS_IN_A_YEAR = 12;

export const MERCHANTS_SHOWN = 10;

export const RECURRING_SHOWN = 5;

const SAVING_SLUGS = new Set<SpendingCategory>(SAVING_CATEGORIES);

export const reviewYearOf = (now: Date): number | null => {
  const year = now.getUTCFullYear();

  if (
    now.getUTCMonth() === DECEMBER &&
    now.getUTCDate() >= REVIEW_OPENING_DAY
  ) {
    return year;
  }

  return now.getUTCMonth() === 0 ? year - 1 : null;
};

export const reviewOpenedAt = (now: Date): Date => {
  const year = reviewYearOf(now);

  return year === null
    ? now
    : new Date(Date.UTC(year, DECEMBER, REVIEW_OPENING_DAY));
};

export const reviewYearRange = (
  year: number,
  rule: BudgetMonthRule
): BudgetMonthRange =>
  budgetMonthsRange({ month: DECEMBER, year }, MONTHS_IN_A_YEAR, rule);

export const reviewYears = (
  firstTransaction: Date | null,
  featuredYear: number
): number[] => {
  if (firstTransaction === null) {
    return [];
  }

  const years: number[] = [];

  for (
    let year = featuredYear;
    year >= firstTransaction.getUTCFullYear();
    year -= 1
  ) {
    years.push(year);
  }

  return years;
};

const monthKeyOf = (date: Date, rule: BudgetMonthRule) =>
  budgetMonthKey(budgetMonthOfBankDate(date, rule));

export const yearFiguresOf = (
  rows: readonly YearRow[],
  rule: BudgetMonthRule
) => {
  let incomeMinor = 0;
  let expensesMinor = 0;
  let paymentCount = 0;
  let savedMinor = 0;
  const months = new Set<string>();

  for (const row of rows) {
    months.add(monthKeyOf(row.date, rule));

    if (row.amount > 0) {
      incomeMinor += row.amount;
    } else if (row.amount < 0) {
      expensesMinor -= row.amount;
      paymentCount += 1;

      if (SAVING_SLUGS.has(effectiveCategory(row))) {
        savedMinor -= row.amount;
      }
    }
  }

  const netMinor = incomeMinor - expensesMinor;

  return {
    expensesMinor,
    incomeMinor,
    monthsWithData: months.size,
    netMinor,
    paymentCount,
    savedMinor,
    savingsRate: incomeMinor > 0 ? (netMinor + savedMinor) / incomeMinor : null,
  };
};

export const monthlyOf = (
  rows: readonly YearRow[],
  range: BudgetMonthRange,
  rule: BudgetMonthRule
) => {
  const months = new Map(
    budgetMonthKeysBetween(range.from, range.to, rule).map((month) => [
      month,
      { incomingMinor: 0, month, outgoingMinor: 0 },
    ])
  );

  for (const row of rows) {
    const month = months.get(monthKeyOf(row.date, rule));

    if (month && row.amount > 0) {
      month.incomingMinor += row.amount;
    } else if (month) {
      month.outgoingMinor -= row.amount;
    }
  }

  return [...months.values()];
};

export const categoriesOf = (
  current: ReadonlyMap<SpendingCategory, number>,
  previous: ReadonlyMap<SpendingCategory, number>
) =>
  [...new Set([...current.keys(), ...previous.keys()])]
    .map((category) => ({
      amountMinor: current.get(category) ?? 0,
      category,
      previousAmountMinor: previous.get(category) ?? 0,
    }))
    .toSorted(
      (a, b) =>
        b.amountMinor - a.amountMinor ||
        b.previousAmountMinor - a.previousAmountMinor
    );

const merchantYears = (
  rows: readonly YearRow[],
  keeps: (row: YearRow & { merchantKey: string }) => boolean
): MerchantYear[] => {
  const merchants = new Map<string, MerchantYear>();

  for (const row of rows) {
    const { merchantKey } = row;

    if (row.amount >= 0 || !merchantKey || !keeps({ ...row, merchantKey })) {
      continue;
    }

    const name = (row.counterpartyName ?? merchantKey).trim().toLowerCase();
    const merchant = merchants.get(name) ?? {
      count: 0,
      merchantKey: name,
      merchantName: null,
      totalMinor: 0,
    };

    merchant.count += 1;
    merchant.totalMinor -= row.amount;
    merchant.merchantName = row.counterpartyName ?? merchant.merchantName;
    merchants.set(name, merchant);
  }

  return [...merchants.values()];
};

export const topMerchantsOf = (rows: readonly YearRow[]) => {
  const merchants = merchantYears(
    rows,
    (row) => !SAVING_SLUGS.has(effectiveCategory(row))
  );

  return {
    byAmount: merchants
      .toSorted((a, b) => b.totalMinor - a.totalMinor || b.count - a.count)
      .slice(0, MERCHANTS_SHOWN),
    byCount: merchants
      .toSorted((a, b) => b.count - a.count || b.totalMinor - a.totalMinor)
      .slice(0, MERCHANTS_SHOWN),
  };
};

export const recurringYearOf = (
  rows: readonly YearRow[],
  recurringKeys: ReadonlySet<string>
) => {
  const merchants = merchantYears(rows, (row) =>
    recurringKeys.has(row.merchantKey)
  ).toSorted((a, b) => b.totalMinor - a.totalMinor);

  return {
    items: merchants.slice(0, RECURRING_SHOWN),
    merchantCount: merchants.length,
    totalMinor: merchants.reduce(
      (sum, merchant) => sum + merchant.totalMinor,
      0
    ),
  };
};

export const largestExpenseOf = (rows: readonly YearRow[]) => {
  let largest: YearRow | null = null;

  for (const row of rows) {
    if (row.amount < 0 && (largest === null || row.amount < largest.amount)) {
      largest = row;
    }
  }

  return largest === null
    ? null
    : {
        amountMinor: -largest.amount,
        category: effectiveCategory(largest),
        date: largest.date.toISOString(),
        merchantKey: largest.merchantKey,
        merchantName: largest.counterpartyName,
      };
};

export const monthsBackToYearStart = (year: number, today: Date): number =>
  today.getUTCFullYear() * MONTHS_IN_A_YEAR +
  today.getUTCMonth() -
  ((year - 1) * MONTHS_IN_A_YEAR + DECEMBER);

export const pointsWithinYear = (
  points: readonly BalancePoint[] | null,
  year: number
): BalancePoint[] =>
  (points ?? []).filter((point) => point.date <= `${year}-12-31`);
