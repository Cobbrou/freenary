import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { transactionFilterConditions } from "./transaction-filter-conditions";
import type { TransactionFilter } from "./transaction-filters";

const ROW_COLUMNS = [
  "amount",
  "category",
  "counterpartyName",
  "normalisedDescriptor",
  "resolvedCategory",
] as const;

type Column = (typeof ROW_COLUMNS)[number];

type Cell = number | string | null;

type Row = Record<Column, Cell>;

type Truth = boolean | null;

const present = z.union([z.number(), z.string()]);

interface Comparison {
  equals?: number | string;
  gt?: number;
  gte?: number;
  in?: (number | string)[];
  insensitive: boolean;
  isNull?: boolean;
  lt?: number;
  lte?: number;
  notIn?: (number | string)[];
}

const comparisonSchema: z.ZodType<Comparison> = z.union([
  z.null().transform(() => ({ insensitive: false, isNull: true })),
  present.transform((equals) => ({ equals, insensitive: false })),
  z
    .object({
      equals: present.optional(),
      gt: z.number().optional(),
      gte: z.number().optional(),
      in: z.array(present).optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
      mode: z.literal("insensitive").optional(),
      not: z.null().optional(),
      notIn: z.array(present).optional(),
    })
    .strict()
    .transform(({ mode, not, ...bounds }) => ({
      ...bounds,
      insensitive: mode === "insensitive",
      isNull: not === null ? false : undefined,
    })),
]);

interface Where {
  NOT?: Where[];
  OR?: Where[];
  columns: Partial<Record<Column, Comparison>>;
}

const whereSchema: z.ZodType<Where> = z.lazy(() =>
  z
    .object({
      NOT: z.array(whereSchema).optional(),
      OR: z.array(whereSchema).optional(),
      amount: comparisonSchema.optional(),
      category: comparisonSchema.optional(),
      counterpartyName: comparisonSchema.optional(),
      normalisedDescriptor: comparisonSchema.optional(),
      resolvedCategory: comparisonSchema.optional(),
    })
    .strict()
    .transform(({ NOT, OR, ...columns }) => ({ NOT, OR, columns }))
);

const allOf = (truths: Truth[]): Truth => {
  if (truths.includes(false)) {
    return false;
  }

  return truths.includes(null) ? null : true;
};

const anyOf = (truths: Truth[]): Truth => {
  if (truths.includes(true)) {
    return true;
  }

  return truths.includes(null) ? null : false;
};

const negation = (truth: Truth): Truth => (truth === null ? null : !truth);

const comparisonHolds = (
  { insensitive, isNull, ...bounds }: Comparison,
  value: Cell
): Truth => {
  const nullness = isNull === undefined ? [] : [isNull === (value === null)];

  if (value === null) {
    const hasValueBound = Object.values(bounds).some(
      (bound) => bound !== undefined
    );

    return allOf([...nullness, ...(hasValueBound ? [null] : [])]);
  }

  const folded = (operand: number | string) =>
    insensitive ? String(operand).toLowerCase() : String(operand);

  return allOf([
    ...nullness,
    bounds.equals === undefined || folded(value) === folded(bounds.equals),
    bounds.gt === undefined || Number(value) > bounds.gt,
    bounds.gte === undefined || Number(value) >= bounds.gte,
    bounds.lt === undefined || Number(value) < bounds.lt,
    bounds.lte === undefined || Number(value) <= bounds.lte,
    bounds.in === undefined || bounds.in.map(folded).includes(folded(value)),
    bounds.notIn === undefined ||
      !bounds.notIn.map(folded).includes(folded(value)),
  ]);
};

const evaluate = (where: Where, row: Row): Truth =>
  allOf([
    ...(where.OR ? [anyOf(where.OR.map((part) => evaluate(part, row)))] : []),
    ...(where.NOT
      ? [allOf(where.NOT.map((part) => negation(evaluate(part, row))))]
      : []),
    ...ROW_COLUMNS.flatMap((column) => {
      const comparison = where.columns[column];

      return comparison === undefined
        ? []
        : [comparisonHolds(comparison, row[column])];
    }),
  ]);

const postgresWouldKeep = (filter: TransactionFilter, row: Row): boolean => {
  const conditions = transactionFilterConditions([filter]);
  const parsed = whereSchema.parse(conditions[0]);

  return evaluate(parsed, row) === true;
};

const comparing = (
  operator: "eq" | "gt" | "lt",
  value: number
): TransactionFilter => ({ field: "amount", operator, value });

const row = (overrides: Partial<Row>): Row => ({
  amount: -1000,
  category: null,
  counterpartyName: null,
  normalisedDescriptor: null,
  resolvedCategory: null,
  ...overrides,
});

describe("company filters", () => {
  const isNotAmazon: TransactionFilter = {
    field: "company",
    operator: "isNot",
    values: ["Amazon"],
  };

  test("is not drops the company whichever column names it", () => {
    expect(
      postgresWouldKeep(isNotAmazon, row({ counterpartyName: "AMAZON" }))
    ).toBe(false);

    expect(
      postgresWouldKeep(isNotAmazon, row({ normalisedDescriptor: "amazon" }))
    ).toBe(false);
  });

  test("is not keeps every other row, including the nameless ones", () => {
    expect(
      postgresWouldKeep(isNotAmazon, row({ normalisedDescriptor: "carrefour" }))
    ).toBe(true);

    expect(postgresWouldKeep(isNotAmazon, row({}))).toBe(true);

    expect(
      postgresWouldKeep(
        isNotAmazon,
        row({ counterpartyName: "Uber", normalisedDescriptor: "amazon" })
      )
    ).toBe(true);
  });

  test("is any of keeps each listed company and nothing else", () => {
    const isAnyOf: TransactionFilter = {
      field: "company",
      operator: "isAnyOf",
      values: ["Amazon", "Uber"],
    };

    expect(postgresWouldKeep(isAnyOf, row({ counterpartyName: "uber" }))).toBe(
      true
    );

    expect(
      postgresWouldKeep(isAnyOf, row({ normalisedDescriptor: "AMAZON" }))
    ).toBe(true);

    expect(
      postgresWouldKeep(isAnyOf, row({ counterpartyName: "Carrefour" }))
    ).toBe(false);

    expect(postgresWouldKeep(isAnyOf, row({}))).toBe(false);
  });
});

describe("category filters", () => {
  const isNotGroceries: TransactionFilter = {
    field: "category",
    operator: "isNot",
    values: ["groceries"],
  };

  test("is not reads the user's category before the pipeline's", () => {
    expect(
      postgresWouldKeep(isNotGroceries, row({ category: "groceries" }))
    ).toBe(false);

    expect(
      postgresWouldKeep(isNotGroceries, row({ resolvedCategory: "groceries" }))
    ).toBe(false);

    expect(
      postgresWouldKeep(
        isNotGroceries,
        row({ category: "restaurants", resolvedCategory: "groceries" })
      )
    ).toBe(true);

    expect(
      postgresWouldKeep(
        isNotGroceries,
        row({ category: "groceries", resolvedCategory: "restaurants" })
      )
    ).toBe(false);
  });

  test("is not keeps an uncategorised row", () => {
    expect(postgresWouldKeep(isNotGroceries, row({}))).toBe(true);
  });

  test("a group stands for every category in it", () => {
    const isSpending: TransactionFilter = {
      field: "category",
      operator: "is",
      values: ["spending"],
    };

    expect(
      postgresWouldKeep(isSpending, row({ resolvedCategory: "groceries" }))
    ).toBe(true);

    expect(postgresWouldKeep(isSpending, row({ category: "salary" }))).toBe(
      false
    );
  });

  test("uncategorised covers a row nothing has categorised", () => {
    const isUncategorised: TransactionFilter = {
      field: "category",
      operator: "is",
      values: ["uncategorised"],
    };

    const isNotUncategorised: TransactionFilter = {
      ...isUncategorised,
      operator: "isNot",
    };

    expect(postgresWouldKeep(isUncategorised, row({}))).toBe(true);
    expect(postgresWouldKeep(isNotUncategorised, row({}))).toBe(false);

    expect(
      postgresWouldKeep(isNotUncategorised, row({ category: "groceries" }))
    ).toBe(true);
  });
});

describe("amount filters", () => {
  test("greater than compares the absolute amount, strictly", () => {
    expect(
      postgresWouldKeep(comparing("gt", 5000), row({ amount: -7150 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("gt", 5000), row({ amount: 7150 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("gt", 5000), row({ amount: -5000 }))
    ).toBe(false);
  });

  test("less than compares the absolute amount, strictly", () => {
    expect(
      postgresWouldKeep(comparing("lt", 5000), row({ amount: -2000 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("lt", 5000), row({ amount: 4999 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("lt", 5000), row({ amount: -5000 }))
    ).toBe(false);
  });

  test("equals matches the amount either way", () => {
    expect(
      postgresWouldKeep(comparing("eq", 1250), row({ amount: -1250 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("eq", 1250), row({ amount: 1250 }))
    ).toBe(true);

    expect(
      postgresWouldKeep(comparing("eq", 1250), row({ amount: 1251 }))
    ).toBe(false);
  });
});
