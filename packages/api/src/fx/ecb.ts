import { Data, Effect } from "effect";

export const ECB_RATES_URL =
  "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A";

const REQUEST_TIMEOUT_MS = 60_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const CURRENCY_CODE = /^[A-Z]{3}$/u;
const QUOTE = '"';
const SEPARATOR = ",";
const LINE_BREAK = /\r?\n/u;

export interface EcbRate {
  currency: string;
  date: string;
  ratePerEur: number;
}

export class EcbRatesUnavailable extends Data.TaggedError(
  "EcbRatesUnavailable"
)<{ readonly detail: string }> {
  override get message() {
    return `The European Central Bank rates could not be read: ${this.detail}`;
  }
}

export const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted && char === QUOTE && line[index + 1] === QUOTE) {
      cell += QUOTE;
      index += 1;
    } else if (char === QUOTE) {
      quoted = !quoted;
    } else if (char === SEPARATOR && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);

  return cells;
};

export const parseEcbCsv = (csv: string): EcbRate[] => {
  const [header, ...lines] = csv.split(LINE_BREAK);

  if (!header) {
    return [];
  }

  const columns = splitCsvLine(header);
  const currencyAt = columns.indexOf("CURRENCY");
  const dateAt = columns.indexOf("TIME_PERIOD");
  const valueAt = columns.indexOf("OBS_VALUE");

  if (currencyAt === -1 || dateAt === -1 || valueAt === -1) {
    return [];
  }

  return lines.flatMap((line) => {
    const cells = splitCsvLine(line);
    const currency = cells[currencyAt] ?? "";
    const date = cells[dateAt] ?? "";
    const ratePerEur = Number(cells[valueAt]);
    const isRate =
      CURRENCY_CODE.test(currency) &&
      ISO_DAY.test(date) &&
      Number.isFinite(ratePerEur) &&
      ratePerEur > 0;

    return isRate ? [{ currency, date, ratePerEur }] : [];
  });
};

export const ecbRatesUrl = (
  startDay: string,
  endDay: string | null = null
): string => {
  const params = new URLSearchParams({
    detail: "dataonly",
    format: "csvdata",
    startPeriod: startDay,
  });

  if (endDay) {
    params.set("endPeriod", endDay);
  }

  return `${ECB_RATES_URL}?${params.toString()}`;
};

export const fetchEcbRates = Effect.fn("fx.fetchEcbRates")(
  function* fetchEcbRates(
    fetchText: (url: string, init: RequestInit) => Promise<Response>,
    startDay: string,
    endDay: string | null = null
  ) {
    const response = yield* Effect.tryPromise({
      catch: (cause) => new EcbRatesUnavailable({ detail: String(cause) }),
      try: () =>
        fetchText(ecbRatesUrl(startDay, endDay), {
          headers: { Accept: "text/csv" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
    });

    if (!response.ok) {
      return yield* new EcbRatesUnavailable({
        detail: `HTTP ${response.status}`,
      });
    }

    const csv = yield* Effect.tryPromise({
      catch: (cause) => new EcbRatesUnavailable({ detail: String(cause) }),
      try: () => response.text(),
    });

    return parseEcbCsv(csv);
  }
);
