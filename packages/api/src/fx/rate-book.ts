import { fromMinor, toMinor } from "../lib/money";

export const REFERENCE_CURRENCY = "EUR";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RateRow {
  currency: string;
  date: Date;
  ratePerEur: number;
}

export interface RateBook {
  convert: (
    amountMinor: number,
    from: string,
    to: string,
    date: Date
  ) => number | null;
  latestDate: Date | null;
  rateOn: (currency: string, date: Date) => number | null;
}

interface DatedRate {
  day: number;
  rate: number;
}

const dayOf = (date: Date): number => Math.floor(date.getTime() / MS_PER_DAY);

const lastAtOrBefore = (
  series: readonly DatedRate[],
  day: number
): DatedRate | undefined => {
  let low = 0;
  let high = series.length - 1;
  let found: DatedRate | undefined;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = series[middle];

    if (candidate && candidate.day <= day) {
      found = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
};

export const rateBookOf = (rows: readonly RateRow[]): RateBook => {
  const byCurrency = new Map<string, DatedRate[]>();
  let latestDay: number | null = null;

  for (const row of rows) {
    const series = byCurrency.get(row.currency) ?? [];
    const day = dayOf(row.date);

    series.push({ day, rate: row.ratePerEur });
    byCurrency.set(row.currency, series);
    latestDay = latestDay === null ? day : Math.max(latestDay, day);
  }

  for (const series of byCurrency.values()) {
    series.sort((a, b) => a.day - b.day);
  }

  const rateOn = (currency: string, date: Date): number | null => {
    if (currency === REFERENCE_CURRENCY) {
      return 1;
    }

    const series = byCurrency.get(currency);

    return series ? (lastAtOrBefore(series, dayOf(date))?.rate ?? null) : null;
  };

  return {
    convert: (amountMinor, from, to, date) => {
      if (from === to) {
        return amountMinor;
      }

      const fromRate = rateOn(from, date);
      const toRate = rateOn(to, date);

      if (fromRate === null || toRate === null) {
        return null;
      }

      const magnitude = toMinor(
        (fromMinor(Math.abs(amountMinor), from) / fromRate) * toRate,
        to
      );

      return amountMinor < 0 ? -magnitude : magnitude;
    },
    latestDate: latestDay === null ? null : new Date(latestDay * MS_PER_DAY),
    rateOn,
  };
};
