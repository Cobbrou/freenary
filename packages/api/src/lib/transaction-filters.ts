import { z } from "zod";

import { CATEGORY_GROUPS, SPENDING_CATEGORIES } from "./taxonomy";

export const TRANSACTION_FILTER_FIELDS = [
  "company",
  "category",
  "amount",
] as const;

export const LIST_FILTER_OPERATORS = ["is", "isNot", "isAnyOf"] as const;

export const AMOUNT_FILTER_OPERATORS = ["gt", "lt", "eq"] as const;

export const CATEGORY_FILTER_VALUES = [
  ...CATEGORY_GROUPS,
  ...SPENDING_CATEGORIES,
] as const;

export const MAX_TRANSACTION_FILTERS = 20;
export const MAX_FILTER_VALUES = 50;
export const MAX_COMPANY_NAME_LENGTH = 200;

export const MAX_FILTER_AMOUNT_MINOR_UNITS = 2_000_000_000;
export const MAX_SEARCH_TEXT_LENGTH = 200;
export const MAX_SAVED_FILTER_NAME_LENGTH = 60;
export const MAX_SAVED_FILTERS = 50;
export const SAVED_FILTER_LIMIT_ERROR = "SAVED_FILTER_LIMIT";

export type TransactionFilterField = (typeof TRANSACTION_FILTER_FIELDS)[number];

export type ListFilterOperator = (typeof LIST_FILTER_OPERATORS)[number];

export type AmountFilterOperator = (typeof AMOUNT_FILTER_OPERATORS)[number];

export type CategoryFilterValue = (typeof CATEGORY_FILTER_VALUES)[number];

export const takesSeveralValues = (operator: ListFilterOperator) =>
  operator === "isAnyOf";

const listFilterSchema = <Field extends string, Value extends z.ZodType>(
  field: Field,
  value: Value
) =>
  z
    .object({
      field: z.literal(field),
      operator: z.enum(LIST_FILTER_OPERATORS),
      values: z.array(value).min(1).max(MAX_FILTER_VALUES),
    })
    .refine(
      ({ operator, values }) =>
        takesSeveralValues(operator) || values.length === 1,
      { message: "`is` and `isNot` take exactly one value", path: ["values"] }
    );

export const transactionFilterSchema = z.discriminatedUnion("field", [
  listFilterSchema(
    "company",
    z.string().trim().min(1).max(MAX_COMPANY_NAME_LENGTH)
  ),
  listFilterSchema("category", z.enum(CATEGORY_FILTER_VALUES)),
  z.object({
    field: z.literal("amount"),
    operator: z.enum(AMOUNT_FILTER_OPERATORS),
    value: z.number().int().min(0).max(MAX_FILTER_AMOUNT_MINOR_UNITS),
  }),
]);

export const transactionFiltersSchema = z
  .array(transactionFilterSchema)
  .max(MAX_TRANSACTION_FILTERS);

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

export type CompanyTransactionFilter = Extract<
  TransactionFilter,
  { field: "company" }
>;

export type CategoryTransactionFilter = Extract<
  TransactionFilter,
  { field: "category" }
>;

export type AmountTransactionFilter = Extract<
  TransactionFilter,
  { field: "amount" }
>;

const NO_CANDIDATES: unknown[] = [];

const canonicalFilterKey = (filter: TransactionFilter) =>
  JSON.stringify(
    filter.field === "amount"
      ? filter
      : { ...filter, values: [...filter.values].toSorted() }
  );

export const lenientTransactionFiltersSchema = z
  .union([z.array(z.unknown()), z.unknown().transform(() => NO_CANDIDATES)])
  .transform((candidates) => {
    const seen = new Set<string>();

    return candidates
      .flatMap((candidate) => {
        const parsed = transactionFilterSchema.safeParse(candidate);

        if (!parsed.success) {
          return [];
        }

        const key = canonicalFilterKey(parsed.data);

        if (seen.has(key)) {
          return [];
        }

        seen.add(key);

        return [parsed.data];
      })
      .slice(0, MAX_TRANSACTION_FILTERS);
  });
