const DIGITS_PROBE_LOCALE = "en";
const DECIMAL_BASE = 10;
const COMMON_MINOR_UNIT_DIGITS = 2;

export const minorUnitDigits = (currency: string): number =>
  new Intl.NumberFormat(DIGITS_PROBE_LOCALE, {
    currency,
    style: "currency",
  }).resolvedOptions().maximumFractionDigits ?? COMMON_MINOR_UNIT_DIGITS;

export const fromMinor = (minorUnits: number, currency: string): number =>
  minorUnits / DECIMAL_BASE ** minorUnitDigits(currency);

export const toMinor = (amount: number, currency: string): number =>
  Math.round(amount * DECIMAL_BASE ** minorUnitDigits(currency));
