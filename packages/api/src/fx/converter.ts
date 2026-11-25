import type { RateBook } from "./rate-book";

export interface Convertible {
  amount: number;
  currency: string;
  date: Date;
  originalAmount?: number | null;
  originalCurrency?: string | null;
}

export interface Converter {
  amountOf: (transaction: Convertible) => number | null;
  convert: (amountMinor: number, from: string, date: Date) => number | null;
  currency: string;
  ratesAsOf: Date | null;
}

export interface Converted<T> {
  rows: (T & { amount: number })[];
  unconvertedCount: number;
}

export const converterOf = (currency: string, book: RateBook): Converter => ({
  amountOf: (transaction) => {
    if (transaction.currency === currency) {
      return transaction.amount;
    }

    const { originalAmount, originalCurrency } = transaction;

    if (
      originalCurrency === currency &&
      originalAmount !== null &&
      originalAmount !== undefined
    ) {
      const magnitude = Math.abs(originalAmount);

      return transaction.amount < 0 ? -magnitude : magnitude;
    }

    return book.convert(
      transaction.amount,
      transaction.currency,
      currency,
      transaction.date
    );
  },
  convert: (amountMinor, from, date) =>
    book.convert(amountMinor, from, currency, date),
  currency,
  ratesAsOf: book.latestDate,
});

export const convertRows = <T extends Convertible>(
  rows: readonly T[],
  converter: Converter
): Converted<T> => {
  const converted: (T & { amount: number })[] = [];
  let unconvertedCount = 0;

  for (const row of rows) {
    const amount = converter.amountOf(row);

    if (amount === null) {
      unconvertedCount += 1;
    } else {
      converted.push({ ...row, amount });
    }
  }

  return { rows: converted, unconvertedCount };
};
