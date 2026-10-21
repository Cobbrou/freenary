export interface AmountRange {
  max: number;
  min: number;
}

const NO_AMOUNT_BOUND = 0;
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
