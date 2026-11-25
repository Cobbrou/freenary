const DIGITS_PROBE_LOCALE = "en";
const DECIMAL_BASE = 10;
const COMMON_MINOR_UNIT_DIGITS = 2;

const digitsByCurrency = new Map<string, number>();

export const minorUnitDigits = (currency: string): number => {
  const known = digitsByCurrency.get(currency);

  if (known !== undefined) {
    return known;
  }

  const digits =
    new Intl.NumberFormat(DIGITS_PROBE_LOCALE, {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? COMMON_MINOR_UNIT_DIGITS;

  digitsByCurrency.set(currency, digits);

  return digits;
};

export const fromMinor = (minorUnits: number, currency: string): number =>
  minorUnits / DECIMAL_BASE ** minorUnitDigits(currency);

export const toMinor = (amount: number, currency: string): number =>
  Math.round(amount * DECIMAL_BASE ** minorUnitDigits(currency));
