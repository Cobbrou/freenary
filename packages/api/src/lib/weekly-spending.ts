import { CATEGORY_GROUP_OF } from "./taxonomy";
import type { SpendingCategory } from "./taxonomy";

export interface WeeklySpendingRow {
  amount: number;
  category: SpendingCategory;
  date: Date;
}

export interface SpendingWeek {
  categories: { amountMinor: number; category: SpendingCategory }[];
  start: string;
  totalMinor: number;
}

const DAYS_PER_WEEK = 7;

const MONDAY_OFFSET = 6;

const MILLISECONDS_PER_DAY = 86_400_000;

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export const weekStartOf = (date: Date): Date => {
  const daysSinceMonday = (date.getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK;

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - daysSinceMonday
    )
  );
};

export const spendingWeeksStart = (to: Date, weeks: number): Date =>
  new Date(
    weekStartOf(to).getTime() -
      (weeks - 1) * DAYS_PER_WEEK * MILLISECONDS_PER_DAY
  );

export const weeklySpending = (
  rows: readonly WeeklySpendingRow[],
  to: Date,
  weeks: number
): SpendingWeek[] => {
  const first = spendingWeeksStart(to, weeks);
  const byWeek = Array.from(
    { length: weeks },
    () => new Map<SpendingCategory, number>()
  );

  for (const row of rows) {
    const week = Math.floor(
      (weekStartOf(row.date).getTime() - first.getTime()) /
        (DAYS_PER_WEEK * MILLISECONDS_PER_DAY)
    );

    const bucket = byWeek[week];
    const isSpending =
      row.amount < 0 && CATEGORY_GROUP_OF[row.category] === "spending";

    if (bucket && isSpending) {
      bucket.set(row.category, (bucket.get(row.category) ?? 0) - row.amount);
    }
  }

  return byWeek.map((bucket, index) => {
    const categories = [...bucket.entries()]
      .map(([category, amountMinor]) => ({ amountMinor, category }))
      .toSorted((a, b) => b.amountMinor - a.amountMinor);

    return {
      categories,
      start: isoDay(
        new Date(first.getTime() + index * DAYS_PER_WEEK * MILLISECONDS_PER_DAY)
      ),
      totalMinor: categories.reduce((sum, entry) => sum + entry.amountMinor, 0),
    };
  });
};
