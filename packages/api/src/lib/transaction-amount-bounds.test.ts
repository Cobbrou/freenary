import { describe, expect, test } from "bun:test";

import type { AmountBoundsCondition } from "./transaction-amount-bounds";
import { amountBoundsCondition } from "./transaction-amount-bounds";

type AmountComparisonOperator = "gt" | "gte" | "lt" | "lte";

type AmountComparison = Record<AmountComparisonOperator, number>;

const holdsForAmount = {
  gt: (amount: number, bound: number) => amount > bound,
  gte: (amount: number, bound: number) => amount >= bound,
  lt: (amount: number, bound: number) => amount < bound,
  lte: (amount: number, bound: number) => amount <= bound,
} satisfies Record<
  AmountComparisonOperator,
  (amount: number, bound: number) => boolean
>;

const postgresWouldKeepRow = (
  condition: NonNullable<AmountBoundsCondition>,
  amount: number
): boolean => {
  // SAFETY: the helper only ever builds `OR` over two `amount` comparisons, and each test below throws before this line when it built nothing.
  const branches = condition.OR as { amount: Partial<AmountComparison> }[];

  return branches.some(({ amount: comparison }) =>
    Object.entries(comparison).every(([operator, bound]) =>
      holdsForAmount[operator as AmountComparisonOperator](amount, bound)
    )
  );
};

describe("transaction amount bounds", () => {
  test("no bound is no condition", () => {
    expect(amountBoundsCondition({})).toBeNull();
  });

  test("a ceiling alone keeps only the amounts under it, either way", () => {
    const condition = amountBoundsCondition({
      maximumAbsoluteMinorUnits: 3000,
    });

    if (!condition) {
      throw new Error("expected a condition");
    }

    expect(postgresWouldKeepRow(condition, -2000)).toBe(true);
    expect(postgresWouldKeepRow(condition, 2000)).toBe(true);
    expect(postgresWouldKeepRow(condition, -7150)).toBe(false);
    expect(postgresWouldKeepRow(condition, 7150)).toBe(false);
  });

  test("a floor alone keeps only the amounts over it, either way", () => {
    const condition = amountBoundsCondition({
      minimumAbsoluteMinorUnits: 5000,
    });

    if (!condition) {
      throw new Error("expected a condition");
    }

    expect(postgresWouldKeepRow(condition, -7150)).toBe(true);
    expect(postgresWouldKeepRow(condition, 7150)).toBe(true);
    expect(postgresWouldKeepRow(condition, -2000)).toBe(false);
    expect(postgresWouldKeepRow(condition, 2000)).toBe(false);
  });

  test("both bounds keep the span, inclusive", () => {
    const condition = amountBoundsCondition({
      maximumAbsoluteMinorUnits: 8000,
      minimumAbsoluteMinorUnits: 4000,
    });

    if (!condition) {
      throw new Error("expected a condition");
    }

    expect(postgresWouldKeepRow(condition, -4000)).toBe(true);
    expect(postgresWouldKeepRow(condition, -8000)).toBe(true);
    expect(postgresWouldKeepRow(condition, 6000)).toBe(true);
    expect(postgresWouldKeepRow(condition, -3999)).toBe(false);
    expect(postgresWouldKeepRow(condition, 8001)).toBe(false);
  });

  test("a floor above the ceiling matches nothing", () => {
    const condition = amountBoundsCondition({
      maximumAbsoluteMinorUnits: 100,
      minimumAbsoluteMinorUnits: 9000,
    });

    if (!condition) {
      throw new Error("expected a condition");
    }

    expect(postgresWouldKeepRow(condition, -5000)).toBe(false);
    expect(postgresWouldKeepRow(condition, 5000)).toBe(false);
  });
});
