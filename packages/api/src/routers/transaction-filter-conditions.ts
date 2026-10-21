import type { Prisma } from "@freenary/db";
import { Match } from "effect";

import { categoriesInGroup, isCategoryGroup } from "../lib/taxonomy";
import type { SpendingCategory } from "../lib/taxonomy";
import type {
  AmountFilterOperator,
  AmountTransactionFilter,
  CategoryFilterValue,
  CategoryTransactionFilter,
  CompanyTransactionFilter,
  TransactionFilter,
} from "../lib/transaction-filters";

type Condition = Prisma.TransactionWhereInput;

const UNCATEGORISED: SpendingCategory = "uncategorised";

const sameNameIgnoringCase = (name: string) => ({
  equals: name,
  mode: "insensitive" as const,
});

export const companyIsOneOf = (names: readonly string[]): Condition => ({
  OR: names.flatMap((name) => [
    { counterpartyName: sameNameIgnoringCase(name) },
    {
      counterpartyName: null,
      normalisedDescriptor: sameNameIgnoringCase(name),
    },
  ]),
});

const companyIsNoneOf = (names: readonly string[]): Condition => ({
  OR: [
    {
      NOT: names.map((name) => ({
        counterpartyName: sameNameIgnoringCase(name),
      })),
      counterpartyName: { not: null },
    },
    { counterpartyName: null, normalisedDescriptor: null },
    {
      NOT: names.map((name) => ({
        normalisedDescriptor: sameNameIgnoringCase(name),
      })),
      counterpartyName: null,
      normalisedDescriptor: { not: null },
    },
  ],
});

export const expandCategoryValues = (
  values: readonly CategoryFilterValue[]
): SpendingCategory[] => {
  const categories = new Set<SpendingCategory>();

  for (const value of values) {
    const members = isCategoryGroup(value) ? categoriesInGroup(value) : [value];

    for (const category of members) {
      categories.add(category);
    }
  }

  return [...categories];
};

export const categoryIsOneOf = (
  categories: readonly SpendingCategory[]
): Condition => {
  const wanted = [...categories];
  const branches: Condition[] = [
    { category: { in: wanted } },
    { category: null, resolvedCategory: { in: wanted } },
  ];

  if (wanted.includes(UNCATEGORISED)) {
    branches.push({ category: null, resolvedCategory: null });
  }

  return { OR: branches };
};

const categoryIsNoneOf = (
  categories: readonly SpendingCategory[]
): Condition => {
  const unwanted = [...categories];
  const branches: Condition[] = [
    { category: { not: null, notIn: unwanted } },
    { category: null, resolvedCategory: { not: null, notIn: unwanted } },
  ];

  if (!unwanted.includes(UNCATEGORISED)) {
    branches.push({ category: null, resolvedCategory: null });
  }

  return { OR: branches };
};

const companyCondition = ({ operator, values }: CompanyTransactionFilter) =>
  operator === "isNot" ? companyIsNoneOf(values) : companyIsOneOf(values);

const categoryCondition = ({ operator, values }: CategoryTransactionFilter) => {
  const categories = expandCategoryValues(values);

  return operator === "isNot"
    ? categoryIsNoneOf(categories)
    : categoryIsOneOf(categories);
};

const ABSOLUTE_AMOUNT_CONDITIONS = {
  eq: (minorUnits) => ({ amount: { in: [minorUnits, -minorUnits] } }),
  gt: (minorUnits) => ({
    OR: [{ amount: { gt: minorUnits } }, { amount: { lt: -minorUnits } }],
  }),
  lt: (minorUnits) => ({ amount: { gt: -minorUnits, lt: minorUnits } }),
} satisfies Record<AmountFilterOperator, (minorUnits: number) => Condition>;

const amountCondition = ({ operator, value }: AmountTransactionFilter) =>
  ABSOLUTE_AMOUNT_CONDITIONS[operator](value);

const conditionOf = Match.type<TransactionFilter>().pipe(
  Match.discriminatorsExhaustive("field")({
    amount: amountCondition,
    category: categoryCondition,
    company: companyCondition,
  })
);

export const transactionFilterConditions = (
  filters: readonly TransactionFilter[]
): Condition[] => filters.map(conditionOf);
