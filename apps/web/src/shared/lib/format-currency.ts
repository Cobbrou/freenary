import { fromMinor, minorUnitDigits } from "@freenary/api/lib/money";

import { getLocale } from "@/paraglide/runtime.js";

const SYMBOL_PROBE_AMOUNT = 1;

const currencyFormat = (currency: string) =>
  new Intl.NumberFormat(getLocale(), { currency, style: "currency" });

export const formatCurrency = (
  amountMinorUnits: number,
  currency: string
): string =>
  currencyFormat(currency).format(fromMinor(amountMinorUnits, currency));

export const formatDecimalCurrency = (
  amount: number,
  currency: string
): string => currencyFormat(currency).format(amount);

export const currencyAffix = (
  currency: string
): { align: "inline-end" | "inline-start"; symbol: string } => {
  const parts = currencyFormat(currency).formatToParts(SYMBOL_PROBE_AMOUNT);
  const symbolAt = parts.findIndex((part) => part.type === "currency");
  const numberAt = parts.findIndex((part) => part.type === "integer");

  return {
    align: symbolAt > numberAt ? "inline-end" : "inline-start",
    symbol: parts[symbolAt]?.value ?? currency,
  };
};

export const formatAmountInput = (
  amountMinorUnits: number,
  currency: string
): string => {
  const digits = minorUnitDigits(currency);

  return new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    trailingZeroDisplay: "stripIfInteger",
    useGrouping: false,
  }).format(fromMinor(amountMinorUnits, currency));
};
