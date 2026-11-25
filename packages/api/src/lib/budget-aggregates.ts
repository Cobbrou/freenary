import prisma, { minorUnitsOf } from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { z } from "zod";

import type {
  RecurringExpense,
  RecurringMonthTotals,
} from "../categorisation/recurrence";
import { convertRows } from "../fx/converter";
import type { Converter } from "../fx/converter";
import { cashFlowAccountsOf, SAVING_CATEGORIES } from "./account-types";
import { AGGREGATION_MODES } from "./aggregation";
import type { AggregationMode } from "./aggregation";
import {
  budgetMonthKey,
  budgetMonthKeysBetween,
  budgetMonthOfBankDate,
} from "./budget-month";
import type { BudgetMonthRule } from "./budget-month";
import type { PlannedLine } from "./budget-planned";
import { periodMonthCount, plannedByCategory } from "./budget-planned";
import { budgetLineKindOf } from "./budget-profile";
import { incomeNodesOf, incomeSourceOf } from "./income-nodes";
import { escapeLikePattern } from "./like-pattern";
import {
  CATEGORY_GROUP_OF,
  CATEGORY_GROUPS,
  SPENDING_CATEGORIES,
} from "./taxonomy";
import type { CategoryGroup, SpendingCategory } from "./taxonomy";
import { effectiveCategory } from "./transaction-category";
import { userBudgetMonthRule } from "./user-budget-month";
import { userConverter } from "./user-currency";
import { weekStartOf } from "./weekly-spending";

interface OutgoingRow {
  amount: number;
  category: string | null;
  date: Date;
  merchantKey: string | null;
  resolvedCategory: string | null;
}

interface PeriodRow extends OutgoingRow {
  counterpartyName: string | null;
}

interface StoredStatRow extends PeriodRow {
  currency: string;
  exchangeFeeMinor: number | null;
  isInternalTransfer: boolean;
  originalAmount: number | null;
  originalCurrency: string | null;
}

interface ConvertedRows<T> {
  rows: T[];
  unconvertedCount: number;
}

interface BudgetLineRow {
  amount: number;
  category: { parentSlug: string | null } | null;
  categorySlug: string | null;
}

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

const DAILY_GRAIN_MAX_DAYS = 31;

const WEEKLY_GRAIN_MAX_DAYS = 93;

type CashFlowGrainName = "day" | "month" | "week";

const EXCHANGE_FEE_CATEGORY: SpendingCategory = "loans-bank-fees";

const SAVING_CATEGORY_SLUGS = new Set<string>(SAVING_CATEGORIES);

const STAT_ROW_SELECT = {
  amount: true,
  category: true,
  counterpartyName: true,
  currency: true,
  date: true,
  exchangeFeeMinor: true,
  isInternalTransfer: true,
  merchantKey: true,
  originalAmount: true,
  originalCurrency: true,
  resolvedCategory: true,
} as const satisfies Prisma.TransactionSelect;

const CONVERTIBLE_SELECT = {
  amount: true,
  currency: true,
  date: true,
  originalAmount: true,
  originalCurrency: true,
} as const satisfies Prisma.TransactionSelect;

interface CashFlowRow {
  incoming: number;
  label: string;
  outgoing: number;
}

const foldIntoBudgetMonths = (
  days: CashFlowRow[],
  rule: BudgetMonthRule
): CashFlowRow[] => {
  const months = new Map<string, CashFlowRow>();

  for (const day of days) {
    const label = budgetMonthKey(
      budgetMonthOfBankDate(new Date(`${day.label}T00:00:00.000Z`), rule)
    );

    const month = months.get(label) ?? { incoming: 0, label, outgoing: 0 };

    month.incoming += day.incoming;
    month.outgoing += day.outgoing;
    months.set(label, month);
  }

  return [...months.values()];
};

const AMOUNT_SIGN_PREDICATE = {
  incoming: 'AND t."amount" > 0',
  outgoing: 'AND t."amount" < 0',
} as const;

const RECURRING_MONTHS = 12;

const cashFlowGrainFor = (spanDays: number): CashFlowGrainName => {
  if (spanDays <= DAILY_GRAIN_MAX_DAYS) {
    return "day";
  }

  if (spanDays <= WEEKLY_GRAIN_MAX_DAYS) {
    return "week";
  }

  return "month";
};

const isoDayOf = (date: Date): string => date.toISOString().slice(0, 10);

export const cashFlowPeriodsOf = (
  rows: readonly { amount: number; date: Date }[],
  grain: Exclude<CashFlowGrainName, "month">
): CashFlowRow[] => {
  const byLabel = new Map<string, CashFlowRow>();

  for (const row of rows) {
    const label = isoDayOf(grain === "day" ? row.date : weekStartOf(row.date));
    const period = byLabel.get(label) ?? { incoming: 0, label, outgoing: 0 };

    if (row.amount > 0) {
      period.incoming += row.amount;
    } else {
      period.outgoing -= row.amount;
    }

    byLabel.set(label, period);
  }

  return [...byLabel.values()].toSorted((a, b) =>
    a.label.localeCompare(b.label)
  );
};

const aggregationSchema = z.enum(AGGREGATION_MODES).default("total");

export const periodInput = z.object({
  aggregation: aggregationSchema,
  from: z.coerce.date(),
  to: z.coerce.date(),
});

interface BucketedPeriod {
  aggregation: AggregationMode;
  from: Date;
  rule: BudgetMonthRule;
  to: Date;
}

const budgetMonthBucketKey = (date: Date, rule: BudgetMonthRule) =>
  budgetMonthKey(budgetMonthOfBankDate(date, rule));

const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];

  if (upper === undefined) {
    return 0;
  }

  const lower = sorted[mid - 1];

  return lower !== undefined && sorted.length % 2 === 0
    ? Math.round((lower + upper) / 2)
    : upper;
};

const aggregateMonthly = <K>(
  monthly: Map<K, Map<string, number>>,
  months: string[],
  mode: Exclude<AggregationMode, "total">
): Map<K, number> => {
  const aggregated = new Map<K, number>();

  for (const [key, monthValues] of monthly) {
    const zeroFilledSeries = months.map((month) => monthValues.get(month) ?? 0);
    aggregated.set(
      key,
      mode === "average"
        ? Math.round(
            zeroFilledSeries.reduce((sum, value) => sum + value, 0) /
              months.length
          )
        : median(zeroFilledSeries)
    );
  }

  return aggregated;
};

const aggregateAmounts = <T extends { amount: number; date: Date }, K>(
  transactions: T[],
  keyOf: (tx: T) => K,
  { aggregation, from, rule, to }: BucketedPeriod,
  rowsMarkingActiveMonths: readonly { date: Date }[] = transactions
): Map<K, number> => {
  if (aggregation === "total") {
    const totals = new Map<K, number>();

    for (const tx of transactions) {
      const key = keyOf(tx);
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(tx.amount));
    }

    return totals;
  }

  const monthsWithTransactions = new Set(
    rowsMarkingActiveMonths.map((row) => budgetMonthBucketKey(row.date, rule))
  );

  const monthly = new Map<K, Map<string, number>>();

  for (const tx of transactions) {
    const key = keyOf(tx);
    const month = budgetMonthBucketKey(tx.date, rule);
    let series = monthly.get(key);

    if (!series) {
      series = new Map();
      monthly.set(key, series);
    }

    series.set(month, (series.get(month) ?? 0) + Math.abs(tx.amount));
  }

  const activeMonths = budgetMonthKeysBetween(from, to, rule).filter((month) =>
    monthsWithTransactions.has(month)
  );

  return aggregateMonthly(monthly, activeMonths, aggregation);
};

export const countedTransactionsWhere = (
  userId: string,
  from: Date,
  to: Date
): Prisma.TransactionWhereInput => ({
  OR: [
    { isInternalTransfer: false },
    { resolvedCategory: { in: [...SAVING_CATEGORIES] } },
    { exchangeFeeMinor: { gt: 0 } },
  ],
  account: cashFlowAccountsOf(userId),
  date: { gte: from, lte: to },
});

export const statRowOf = (row: StoredStatRow): StoredStatRow => {
  const countsWhole =
    !row.isInternalTransfer ||
    (row.resolvedCategory !== null &&
      SAVING_CATEGORY_SLUGS.has(row.resolvedCategory));

  if (countsWhole) {
    return row;
  }

  return {
    ...row,
    amount: -(row.exchangeFeeMinor ?? 0),
    category: EXCHANGE_FEE_CATEGORY,
    counterpartyName: null,
    merchantKey: null,
    originalAmount: null,
    originalCurrency: null,
    resolvedCategory: EXCHANGE_FEE_CATEGORY,
  };
};

const countedRows = async (
  userId: string,
  from: Date,
  to: Date,
  converter: Converter,
  outgoingOnly: boolean
): Promise<ConvertedRows<PeriodRow>> => {
  const where = countedTransactionsWhere(userId, from, to);

  if (outgoingOnly) {
    where.amount = { lt: 0 };
  }

  const stored = await prisma.transaction.findMany({
    select: STAT_ROW_SELECT,
    where,
  });

  const { rows, unconvertedCount } = convertRows(
    stored.map(statRowOf),
    converter
  );

  return {
    rows: rows.map((row) => ({
      amount: row.amount,
      category: row.category,
      counterpartyName: row.counterpartyName,
      date: row.date,
      merchantKey: row.merchantKey,
      resolvedCategory: row.resolvedCategory,
    })),
    unconvertedCount,
  };
};

export const outgoingRows = (
  userId: string,
  from: Date,
  to: Date,
  converter: Converter
): Promise<ConvertedRows<OutgoingRow>> =>
  countedRows(userId, from, to, converter, true);

export const outgoingByCategory = (
  rows: OutgoingRow[],
  period: BucketedPeriod
): Map<SpendingCategory, number> =>
  aggregateAmounts(rows, effectiveCategory, period);

const recurringShareByCategory = (
  rows: OutgoingRow[],
  recurringKeys: Set<string>
): Map<SpendingCategory, number> => {
  const sums = new Map<SpendingCategory, { all: number; recurring: number }>();

  for (const row of rows) {
    const category = effectiveCategory(row);
    let categorySums = sums.get(category);

    if (!categorySums) {
      categorySums = { all: 0, recurring: 0 };
      sums.set(category, categorySums);
    }

    const amount = Math.abs(row.amount);
    categorySums.all += amount;

    if (row.merchantKey !== null && recurringKeys.has(row.merchantKey)) {
      categorySums.recurring += amount;
    }
  }

  const shares = new Map<SpendingCategory, number>();

  for (const [category, { all, recurring }] of sums) {
    shares.set(category, all > 0 ? recurring / all : 0);
  }

  return shares;
};

export const userOutgoingByCategory = async (
  userId: string,
  period: Omit<BucketedPeriod, "rule">,
  converter: Converter
): Promise<{
  byCategory: Map<SpendingCategory, number>;
  unconvertedCount: number;
}> => {
  const [outgoing, rule] = await Promise.all([
    outgoingRows(userId, period.from, period.to, converter),
    userBudgetMonthRule(userId),
  ]);

  return {
    byCategory: outgoingByCategory(outgoing.rows, { ...period, rule }),
    unconvertedCount: outgoing.unconvertedCount,
  };
};

export const convertedTotals = async (
  where: Prisma.TransactionWhereInput,
  converter: Converter
) => {
  const { amount: _direction, ...anyDirection } = where;
  const counted: Prisma.TransactionWhereInput = {
    AND: [anyDirection, { isInternalTransfer: false }],
  };

  const [incoming, outgoing, foreign] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        AND: [counted, { amount: { gt: 0 }, currency: converter.currency }],
      },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        AND: [counted, { amount: { lt: 0 }, currency: converter.currency }],
      },
    }),
    prisma.transaction.findMany({
      select: CONVERTIBLE_SELECT,
      where: { AND: [counted, { currency: { not: converter.currency } }] },
    }),
  ]);

  const totals = {
    incoming: minorUnitsOf(incoming._sum.amount ?? 0),
    outgoing: Math.abs(minorUnitsOf(outgoing._sum.amount ?? 0)),
    unconvertedCount: 0,
  };

  const converted = convertRows(foreign, converter);

  for (const row of converted.rows) {
    if (row.amount > 0) {
      totals.incoming += row.amount;
    } else {
      totals.outgoing -= row.amount;
    }
  }

  totals.unconvertedCount = converted.unconvertedCount;

  return totals;
};

export const outgoingBudgetLines = (lines: BudgetLineRow[]): PlannedLine[] =>
  lines.flatMap((line) => {
    const planned: PlannedLine = {
      amount: line.amount,
      categorySlug: line.categorySlug,
      parentSlug: line.category?.parentSlug ?? null,
    };

    return budgetLineKindOf(planned) === "OUTGOING" ? [planned] : [];
  });

export const budgetLinesOf = (userId: string): Promise<BudgetLineRow[]> =>
  prisma.budgetLine.findMany({
    select: {
      amount: true,
      category: { select: { parentSlug: true } },
      categorySlug: true,
    },
    where: { userId },
  });

export const periodRows = (
  userId: string,
  from: Date,
  to: Date,
  converter: Converter
): Promise<ConvertedRows<PeriodRow>> =>
  countedRows(userId, from, to, converter, false);

export const cashFlow = async (
  userId: string,
  { from, grain, to }: { from: Date; grain?: CashFlowGrainName; to: Date }
) => {
  const spanDays = Math.ceil(
    (to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY
  );

  const resolvedGrain = grain ?? cashFlowGrainFor(spanDays);
  const converter = await userConverter(userId, from, to);
  const [counted, rule] = await Promise.all([
    periodRows(userId, from, to, converter),
    userBudgetMonthRule(userId),
  ]);

  const periods = cashFlowPeriodsOf(
    counted.rows,
    resolvedGrain === "week" ? "week" : "day"
  );

  return {
    currency: converter.currency,
    periods:
      resolvedGrain === "month" ? foldIntoBudgetMonths(periods, rule) : periods,
    unconvertedCount: counted.unconvertedCount,
  };
};

export const merchantTotals = async (
  userId: string,
  {
    accountId,
    direction,
    from,
    limit,
    search,
    to,
  }: {
    accountId?: string;
    direction?: keyof typeof AMOUNT_SIGN_PREDICATE;
    from: Date;
    limit: number;
    search?: string;
    to: Date;
  }
) => {
  const signPredicate = direction ? AMOUNT_SIGN_PREDICATE[direction] : "";
  const merchantFilter = `FROM "transaction" t
    JOIN "bank_account" ba ON ba."id" = t."accountId"
    JOIN "bank_connection" bc ON bc."id" = ba."connectionId"
    WHERE bc."userId" = $1
      AND t."date" >= $2
      AND t."date" <= $3
      AND COALESCE(t."counterpartyName", t."normalisedDescriptor") <> ''
      AND ($4::text IS NULL OR COALESCE(t."counterpartyName", t."normalisedDescriptor") ILIKE '%' || $4 || '%')
      AND ($5::text IS NULL OR t."accountId" = $5)
      ${signPredicate}`;

  const merchantsSql = `SELECT
      lower(COALESCE(t."counterpartyName", t."normalisedDescriptor")) AS key,
      MIN(COALESCE(t."counterpartyName", initcap(t."normalisedDescriptor"))) AS name,
      COUNT(*)::bigint AS count
    ${merchantFilter}
    GROUP BY lower(COALESCE(t."counterpartyName", t."normalisedDescriptor"))
    ORDER BY count DESC, name ASC
    LIMIT $6`;

  const amountsSql = `SELECT
      lower(COALESCE(t."counterpartyName", t."normalisedDescriptor")) AS key,
      t."amount"::float8 AS "amount", t."currency", t."date", t."originalAmount"::float8 AS "originalAmount", t."originalCurrency"
    ${merchantFilter}
      AND lower(COALESCE(t."counterpartyName", t."normalisedDescriptor")) = ANY($6::text[])`;

  const filterParams = [
    userId,
    from,
    to,
    search === undefined ? null : escapeLikePattern(search),
    accountId ?? null,
  ];

  const [rows, converter] = await Promise.all([
    prisma.$queryRawUnsafe<{ count: bigint; key: string; name: string }[]>(
      merchantsSql,
      ...filterParams,
      limit
    ),
    userConverter(userId, from, to),
  ]);

  const amounts = await prisma.$queryRawUnsafe<
    {
      amount: number;
      currency: string;
      date: Date;
      key: string;
      originalAmount: number | null;
      originalCurrency: string | null;
    }[]
  >(
    amountsSql,
    ...filterParams,
    rows.map((row) => row.key)
  );

  const totals = new Map<string, number>();
  const converted = convertRows(amounts, converter);

  for (const row of converted.rows) {
    totals.set(row.key, (totals.get(row.key) ?? 0) + Math.abs(row.amount));
  }

  return {
    currency: converter.currency,
    merchants: rows.map((row) => ({
      count: Number(row.count),
      name: row.name,
      totalMinor: totals.get(row.key) ?? 0,
    })),
    unconvertedCount: converted.unconvertedCount,
  };
};

export const spendingBreakdownOf = (
  byCategory: Map<SpendingCategory, number>
) => ({
  categories: [...byCategory.entries()]
    .map(([category, amount]) => ({ amount, category }))
    .toSorted((a, b) => b.amount - a.amount),
});

export const budgetVsActualOf = (
  lines: BudgetLineRow[],
  actualByCategory: Map<SpendingCategory, number>,
  { aggregation, from, to }: z.infer<typeof periodInput>
) => {
  const outgoings = outgoingBudgetLines(lines);
  const planScaleMonths =
    aggregation === "total" ? periodMonthCount(from, to, new Date()) : 1;

  const planned = plannedByCategory(outgoings, planScaleMonths);
  const categories = SPENDING_CATEGORIES.flatMap((category) => {
    const row = {
      actual: actualByCategory.get(category) ?? 0,
      category,
      planned: planned.get(category) ?? 0,
    };

    return row.planned > 0 || row.actual > 0 ? [row] : [];
  }).toSorted((a, b) => b.planned - a.planned || b.actual - a.actual);

  return {
    categories,
    hasPlan: outgoings.length > 0,
  };
};

export const fixedVsVariableOf = (
  rows: OutgoingRow[],
  byCategory: Map<SpendingCategory, number>,
  recurring: RecurringExpense[]
) => {
  const recurringShare = recurringShareByCategory(
    rows,
    new Set(recurring.map((e) => e.merchantKey))
  );

  let fixed = 0;
  let total = 0;

  for (const [category, amount] of byCategory) {
    fixed += Math.round(amount * (recurringShare.get(category) ?? 0));
    total += amount;
  }

  return { fixed, variable: total - fixed };
};

const calendarMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const trailingCalendarMonthKeys = (to: Date): string[] => {
  const keys: string[] = [];

  for (let back = RECURRING_MONTHS - 1; back >= 0; back -= 1) {
    keys.push(
      calendarMonthKey(new Date(to.getFullYear(), to.getMonth() - back, 1))
    );
  }

  return keys;
};

export const zeroFilledMonths = (
  totals: RecurringMonthTotals[],
  keys: string[]
): RecurringMonthTotals[] => {
  const byMonth = new Map(totals.map((total) => [total.month, total]));

  return keys.map(
    (month) =>
      byMonth.get(month) ?? {
        behavioralMinor: 0,
        discretionaryMinor: 0,
        fixedMinor: 0,
        month,
      }
  );
};

export const sankeyOf = (rows: PeriodRow[], period: BucketedPeriod) => {
  const incomeSources = aggregateAmounts(
    rows.filter((row) => row.amount > 0),
    incomeSourceOf,
    period,
    rows
  );

  const expenseCategories = aggregateAmounts(
    rows.filter((row) => row.amount <= 0),
    effectiveCategory,
    period,
    rows
  );

  const incomeNodes = incomeNodesOf(incomeSources);

  const byGroup = new Map<
    CategoryGroup,
    { category: SpendingCategory; value: number }[]
  >();

  for (const [category, value] of expenseCategories) {
    if (value <= 0) {
      continue;
    }

    const group = CATEGORY_GROUP_OF[category];
    const leaves = byGroup.get(group);
    const leaf = { category, value };

    if (leaves) {
      leaves.push(leaf);
    } else {
      byGroup.set(group, [leaf]);
    }
  }

  const groups = CATEGORY_GROUPS.flatMap((group) => {
    const leaves = byGroup.get(group);

    if (!leaves) {
      return [];
    }

    const categories = leaves.toSorted((a, b) => b.value - a.value);

    return [
      {
        categories,
        group,
        value: categories.reduce((sum, leaf) => sum + leaf.value, 0),
      },
    ];
  });

  const totalIncome = incomeNodes.reduce((s, n) => s + n.value, 0);
  const totalExpenses = groups.reduce((s, g) => s + g.value, 0);

  return {
    groups,
    incomeNodes,
    moneyLeft: Math.max(0, totalIncome - totalExpenses),
    totalExpenses,
    totalIncome,
  };
};
