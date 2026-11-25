import prisma from "@freenary/db";
import { Data, Effect, Schedule } from "effect";

import { fetchEcbRates } from "./ecb";
import { REFERENCE_CURRENCY, rateBookOf } from "./rate-book";
import type { RateBook, RateRow } from "./rate-book";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIRST_ECB_DAY = "1999-01-04";
const DEFAULT_HISTORY_DAYS = 2 * 365;
const LOOKBACK_DAYS = 14;
const REFRESH_INTERVAL = "6 hours";
const INSERT_BATCH_SIZE = 5000;

class ExchangeRatesNotStored extends Data.TaggedError(
  "ExchangeRatesNotStored"
)<{
  readonly detail: string;
}> {
  override get message() {
    return `The exchange rates could not be stored: ${this.detail}`;
  }
}

const notStored = (cause: unknown) =>
  new ExchangeRatesNotStored({ detail: String(cause) });

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const dayBefore = (date: Date): Date => new Date(date.getTime() - MS_PER_DAY);

const laterDay = (a: string, b: string): string => (a > b ? a : b);

export interface StoredRange {
  earliest: Date | null;
  latest: Date | null;
}

export const missingRateRanges = (
  stored: StoredRange,
  earliestNeeded: Date,
  today: Date
): { endDay?: string; startDay: string }[] => {
  const wantedStart = laterDay(isoDay(earliestNeeded), FIRST_ECB_DAY);

  if (stored.earliest === null || stored.latest === null) {
    return [{ startDay: wantedStart }];
  }

  const ranges: { endDay?: string; startDay: string }[] = [];

  if (wantedStart < isoDay(stored.earliest)) {
    ranges.push({
      endDay: isoDay(dayBefore(stored.earliest)),
      startDay: wantedStart,
    });
  }

  if (isoDay(stored.latest) < isoDay(today)) {
    ranges.push({
      startDay: isoDay(new Date(stored.latest.getTime() + MS_PER_DAY)),
    });
  }

  return ranges;
};

const earliestNeededDay = async (today: Date): Promise<Date> => {
  const transactions = await prisma.transaction.aggregate({
    _min: { date: true },
  });

  const defaultStart = new Date(
    today.getTime() - DEFAULT_HISTORY_DAYS * MS_PER_DAY
  );

  const earliest = transactions._min.date;
  const start = earliest && earliest < defaultStart ? earliest : defaultStart;

  return new Date(start.getTime() - LOOKBACK_DAYS * MS_PER_DAY);
};

const storeRates = async (rates: readonly RateRow[]): Promise<number> => {
  let stored = 0;

  for (let start = 0; start < rates.length; start += INSERT_BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop -- one batch at a time keeps each insert small
    const { count } = await prisma.exchangeRate.createMany({
      data: rates.slice(start, start + INSERT_BATCH_SIZE).map((rate) => ({
        currency: rate.currency,
        date: rate.date,
        ratePerEur: rate.ratePerEur,
      })),
      skipDuplicates: true,
    });

    stored += count;
  }

  return stored;
};

export const refreshExchangeRates = Effect.fn("fx.refreshExchangeRates")(
  function* refreshExchangeRates(
    fetchText: (url: string, init: RequestInit) => Promise<Response>,
    today: Date = new Date()
  ) {
    const [stored, earliestNeeded] = yield* Effect.tryPromise({
      catch: notStored,
      try: () =>
        Promise.all([
          prisma.exchangeRate.aggregate({
            _max: { date: true },
            _min: { date: true },
          }),
          earliestNeededDay(today),
        ]),
    });

    const ranges = missingRateRanges(
      { earliest: stored._min.date, latest: stored._max.date },
      earliestNeeded,
      today
    );

    let added = 0;

    for (const range of ranges) {
      const fetched = yield* fetchEcbRates(
        fetchText,
        range.startDay,
        range.endDay
      );

      added += yield* Effect.tryPromise({
        catch: notStored,
        try: () =>
          storeRates(
            fetched.map((rate) => ({
              currency: rate.currency,
              date: new Date(`${rate.date}T00:00:00.000Z`),
              ratePerEur: rate.ratePerEur,
            }))
          ),
      });
    }

    return added;
  }
);

const warnRefreshFailed = (failure: { readonly message: string }) =>
  Effect.sync(() => {
    console.warn(
      `[exchange-rates] ${failure.message}. The stored rates stay in use and the refresh runs again in ${REFRESH_INTERVAL}.`
    );
  });

const refreshQuietly = (
  fetchText: (url: string, init: RequestInit) => Promise<Response>
) =>
  refreshExchangeRates(fetchText).pipe(
    Effect.asVoid,
    Effect.catchTags({
      EcbRatesUnavailable: warnRefreshFailed,
      ExchangeRatesNotStored: warnRefreshFailed,
    })
  );

export const refreshExchangeRatesNow = (): Promise<void> =>
  Effect.runPromise(refreshQuietly(fetch));

export const exchangeRateRefresh = {
  start: () => {
    Effect.runFork(
      refreshQuietly(fetch).pipe(
        Effect.repeat(Schedule.spaced(REFRESH_INTERVAL))
      )
    );
  },
};

const ratesBetween = async (
  currencies: readonly string[],
  from: Date,
  to: Date
): Promise<RateRow[]> => {
  const foreign = [
    ...new Set(currencies.filter((code) => code !== REFERENCE_CURRENCY)),
  ];

  if (foreign.length === 0) {
    return [];
  }

  const lookbackStart = new Date(from.getTime() - LOOKBACK_DAYS * MS_PER_DAY);

  const [window, lastBefore] = await Promise.all([
    prisma.exchangeRate.findMany({
      select: { currency: true, date: true, ratePerEur: true },
      where: {
        currency: { in: foreign },
        date: { gte: lookbackStart, lte: to },
      },
    }),
    prisma.exchangeRate.findMany({
      distinct: ["currency"],
      orderBy: [{ currency: "asc" }, { date: "desc" }],
      select: { currency: true, date: true, ratePerEur: true },
      where: { currency: { in: foreign }, date: { lt: lookbackStart } },
    }),
  ]);

  return [...lastBefore, ...window];
};

export const loadRateBook = async (
  currencies: readonly string[],
  from: Date,
  to: Date
): Promise<RateBook> => rateBookOf(await ratesBetween(currencies, from, to));

export const availableRateCurrencies = async (): Promise<string[]> => {
  const rows = await prisma.exchangeRate.findMany({
    distinct: ["currency"],
    orderBy: { currency: "asc" },
    select: { currency: true },
  });

  return [REFERENCE_CURRENCY, ...rows.map((row) => row.currency)].toSorted();
};

export const latestRateDate = async (): Promise<Date | null> => {
  const latest = await prisma.exchangeRate.aggregate({ _max: { date: true } });

  return latest._max.date;
};
