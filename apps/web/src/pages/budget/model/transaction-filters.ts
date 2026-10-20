import { filterCount } from "@/entities/category";
import type { CategoryFilter } from "@/entities/category";

export interface AmountRange {
  max: number;
  min: number;
}

const NO_AMOUNT_BOUND = 0;
const AMOUNT_RANGE_COUNTS_ONCE = 1;
const MINOR_PER_UNIT = 100;
const GROUPED_SAMPLE_NUMBER = 11_111;

export const EMPTY_AMOUNT_RANGE: AmountRange = {
  max: NO_AMOUNT_BOUND,
  min: NO_AMOUNT_BOUND,
};

const NOT_A_NUMBER = /[^\d.]/gu;
const SPACING = /[\s\u00A0\u202F']/gu;

const localeGroupSeparator = (locale: string) =>
  new Intl.NumberFormat(locale)
    .formatToParts(GROUPED_SAMPLE_NUMBER)
    .find((part) => part.type === "group")?.value;

export const parseAmountBound = (text: string, locale: string): number => {
  const group = localeGroupSeparator(locale);
  const withCommasAsDots = text
    .replace(SPACING, "")
    .replaceAll(group ?? ",", "")
    .replaceAll(",", ".");

  const lastDot = withCommasAsDots.lastIndexOf(".");
  const onlyDecimalDotSurvives =
    lastDot === -1
      ? withCommasAsDots
      : `${withCommasAsDots.slice(0, lastDot).replaceAll(".", "")}.${withCommasAsDots.slice(lastDot + 1)}`;

  const value = Number(onlyDecimalDotSurvives.replace(NOT_A_NUMBER, ""));

  return Number.isFinite(value) && value > 0 ? value : NO_AMOUNT_BOUND;
};

export const amountBoundsMinor = (amount: AmountRange) => ({
  amountMax:
    amount.max > NO_AMOUNT_BOUND
      ? Math.round(amount.max * MINOR_PER_UNIT)
      : undefined,
  amountMin:
    amount.min > NO_AMOUNT_BOUND
      ? Math.round(amount.min * MINOR_PER_UNIT)
      : undefined,
});

export const toggleMerchant = (merchants: string[], value: string): string[] =>
  merchants.includes(value)
    ? merchants.filter((merchant) => merchant !== value)
    : [...merchants, value];

export const activeFilterCount = (
  filter: CategoryFilter,
  merchants: string[],
  amount: AmountRange
): number =>
  filterCount(filter) +
  merchants.length +
  (amount.min > NO_AMOUNT_BOUND || amount.max > NO_AMOUNT_BOUND
    ? AMOUNT_RANGE_COUNTS_ONCE
    : 0);
