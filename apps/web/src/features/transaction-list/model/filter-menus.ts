import type {
  AmountFilterOperator,
  TransactionFilter,
} from "@freenary/api/lib/transaction-filters";

export interface AmountPreset {
  minorUnits: number;
  operator: Extract<AmountFilterOperator, "gt" | "lt">;
}

export interface MonthChoice {
  isCurrent: boolean;
  label: string;
  month: number;
  year: number;
}

const CENTS = 100;

export const AMOUNT_PRESETS: readonly AmountPreset[] = [
  { minorUnits: 50 * CENTS, operator: "gt" },
  { minorUnits: 100 * CENTS, operator: "gt" },
  { minorUnits: 20 * CENTS, operator: "lt" },
];

const MONTHS_LISTED = 6;

export const replacingField = (
  filters: readonly TransactionFilter[],
  filter: TransactionFilter
): TransactionFilter[] => [
  ...filters.filter((kept) => kept.field !== filter.field),
  filter,
];

export const singleValueOf = (
  filters: readonly TransactionFilter[],
  field: "account" | "category"
): string | null => {
  const matching = filters.filter((filter) => filter.field === field);
  const [only] = matching;

  if (
    matching.length !== 1 ||
    only === undefined ||
    only.field === "amount" ||
    only.operator !== "is"
  ) {
    return null;
  }

  return only.values[0] ?? null;
};

export const recentMonths = ({
  current,
  first,
  last,
  locale,
}: {
  current: { month: number; year: number } | null;
  first: Date | undefined;
  last: Date;
  locale: string;
}): MonthChoice[] =>
  Array.from({ length: MONTHS_LISTED }, (_, back) => {
    const date = new Date(last.getFullYear(), last.getMonth() - back, 1);

    return first !== undefined && date < first
      ? []
      : [
          {
            isCurrent:
              current !== null &&
              current.year === date.getFullYear() &&
              current.month === date.getMonth(),
            label: date.toLocaleDateString(locale, {
              month: "long",
              year: "numeric",
            }),
            month: date.getMonth(),
            year: date.getFullYear(),
          },
        ];
  }).flat();
