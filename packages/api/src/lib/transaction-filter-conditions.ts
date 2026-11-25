import type { Prisma } from "@freenary/db";
import { Match } from "effect";

import { minorUnitDigits } from "./money";
import { categoriesInGroup, isCategoryGroup } from "./taxonomy";
import type { SpendingCategory } from "./taxonomy";
import type {
  AccountTransactionFilter,
  AmountFilterOperator,
  AmountTransactionFilter,
  CategoryFilterValue,
  CategoryTransactionFilter,
  CompanyTransactionFilter,
  TransactionFilter,
} from "./transaction-filters";

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

const accountCondition = ({
  operator,
  values,
}: AccountTransactionFilter): Condition =>
  operator === "isNot"
    ? { accountId: { notIn: [...values] } }
    : { accountId: { in: [...values] } };

const ABSOLUTE_AMOUNT_CONDITIONS = {
  eq: (minorUnits) => ({ amount: { in: [minorUnits, -minorUnits] } }),
  gt: (minorUnits) => ({
    OR: [{ amount: { gt: minorUnits } }, { amount: { lt: -minorUnits } }],
  }),
  lt: (minorUnits) => ({ amount: { gt: -minorUnits, lt: minorUnits } }),
} satisfies Record<AmountFilterOperator, (minorUnits: number) => Condition>;

const NO_TRANSACTION: Condition = { id: { in: [] } };

const DECIMAL_BASE = 10;

const currenciesByDigits = (): Map<number, string[]> => {
  const groups = new Map<number, string[]>();

  for (const currency of Intl.supportedValuesOf("currency")) {
    const digits = minorUnitDigits(currency);
    const group = groups.get(digits) ?? [];

    group.push(currency);
    groups.set(digits, group);
  }

  return groups;
};

let digitGroups: Map<number, string[]> | undefined;

const scaledAmountCondition = (
  operator: AmountFilterOperator,
  scaled: number
): Condition => {
  if (Number.isInteger(scaled)) {
    return ABSOLUTE_AMOUNT_CONDITIONS[operator](scaled);
  }

  if (operator === "eq") {
    return NO_TRANSACTION;
  }

  return ABSOLUTE_AMOUNT_CONDITIONS[operator](
    operator === "gt" ? Math.floor(scaled) : Math.ceil(scaled)
  );
};

export const amountCondition = (
  { operator, value }: AmountTransactionFilter,
  filterCurrency: string
): Condition => {
  digitGroups ??= currenciesByDigits();

  const filterDigits = minorUnitDigits(filterCurrency);
  const otherDigitCurrencies: string[] = [];
  const branches: Condition[] = [];

  for (const [digits, currencies] of digitGroups) {
    if (digits !== filterDigits) {
      otherDigitCurrencies.push(...currencies);
      branches.push({
        AND: [
          { currency: { in: currencies } },
          scaledAmountCondition(
            operator,
            value * DECIMAL_BASE ** (digits - filterDigits)
          ),
        ],
      });
    }
  }

  branches.push({
    AND: [
      { currency: { notIn: otherDigitCurrencies } },
      ABSOLUTE_AMOUNT_CONDITIONS[operator](value),
    ],
  });

  return { OR: branches };
};

const conditionOf = (filter: TransactionFilter, filterCurrency: string) =>
  Match.value(filter).pipe(
    Match.discriminatorsExhaustive("field")({
      account: accountCondition,
      amount: (amount) => amountCondition(amount, filterCurrency),
      category: categoryCondition,
      company: companyCondition,
    })
  );

export const transactionFilterConditions = (
  filters: readonly TransactionFilter[],
  filterCurrency: string
): Condition[] => filters.map((filter) => conditionOf(filter, filterCurrency));
