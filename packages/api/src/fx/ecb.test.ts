import { describe, expect, it } from "bun:test";

import { Effect, Result } from "effect";

import {
  ECB_RATES_URL,
  EcbRatesUnavailable,
  ecbRatesUrl,
  fetchEcbRates,
  parseEcbCsv,
  splitCsvLine,
} from "./ecb";

const HEADER =
  "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE";

const CSV = [
  HEADER,
  "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05-04,1.1702",
  "EXR.D.JPY.EUR.SP00.A,D,JPY,EUR,SP00,A,2026-05-04,183.42",
  "",
].join("\r\n");

describe("splitCsvLine", () => {
  it("keeps commas and doubled quotes inside a quoted cell", () => {
    expect(splitCsvLine('a,"b, c","say ""hi""",')).toEqual([
      "a",
      "b, c",
      'say "hi"',
      "",
    ]);
  });
});

describe("parseEcbCsv", () => {
  it("reads currency, day and rate from the ECB columns", () => {
    expect(parseEcbCsv(CSV)).toEqual([
      { currency: "USD", date: "2026-05-04", ratePerEur: 1.1702 },
      { currency: "JPY", date: "2026-05-04", ratePerEur: 183.42 },
    ]);
  });

  it("reads a row whose quoted cells hold commas", () => {
    expect(
      parseEcbCsv(
        [
          HEADER,
          '"EXR.D.GBP.EUR.SP00.A","D,daily",GBP,EUR,SP00,A,2026-05-04,"0.8571"',
        ].join("\n")
      )
    ).toEqual([{ currency: "GBP", date: "2026-05-04", ratePerEur: 0.8571 }]);
  });

  it("skips empty, non-numeric, zero and malformed observations", () => {
    expect(
      parseEcbCsv(
        [
          HEADER,
          "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05-01,",
          "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05-02,NaN",
          "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05-03,0",
          "EXR.D.USD.EUR.SP00.A,D,usd,EUR,SP00,A,2026-05-04,1.17",
          "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05,1.17",
          "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-05-05,1.18",
        ].join("\n")
      )
    ).toEqual([{ currency: "USD", date: "2026-05-05", ratePerEur: 1.18 }]);
  });

  it("reads nothing from an unknown header or an empty body", () => {
    expect(parseEcbCsv("A,B,C\nUSD,2026-05-04,1.1")).toEqual([]);
    expect(parseEcbCsv("")).toEqual([]);
  });
});

describe("ecbRatesUrl", () => {
  it("asks for plain CSV data from the start day", () => {
    const url = new URL(ecbRatesUrl("2026-05-01"));

    expect(`${url.origin}${url.pathname}`).toBe(ECB_RATES_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      detail: "dataonly",
      format: "csvdata",
      startPeriod: "2026-05-01",
    });
  });

  it("adds the end day when there is one", () => {
    const url = new URL(ecbRatesUrl("2026-05-01", "2026-05-31"));

    expect(url.searchParams.get("endPeriod")).toBe("2026-05-31");
  });
});

describe("fetchEcbRates", () => {
  it("parses the CSV the ECB returns", async () => {
    const requested: string[] = [];
    const rates = await Effect.runPromise(
      fetchEcbRates(
        (url) => {
          requested.push(url);

          return Promise.resolve(new Response(CSV));
        },
        "2026-05-04",
        "2026-05-04"
      )
    );

    expect(requested).toEqual([ecbRatesUrl("2026-05-04", "2026-05-04")]);
    expect(rates).toHaveLength(2);
  });

  it("fails as unavailable on an HTTP error", async () => {
    const outcome = await Effect.runPromise(
      Effect.result(
        fetchEcbRates(
          () => Promise.resolve(new Response("down", { status: 500 })),
          "2026-05-04"
        )
      )
    );

    expect(Result.isFailure(outcome)).toBe(true);
    expect(
      Result.match(outcome, {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    ).toBeInstanceOf(EcbRatesUnavailable);

    expect(
      Result.match(outcome, {
        onFailure: (failure) => failure.detail,
        onSuccess: () => null,
      })
    ).toBe("HTTP 500");
  });

  it("fails as unavailable when the request itself fails", async () => {
    const outcome = await Effect.runPromise(
      Effect.result(
        fetchEcbRates(() => Promise.reject(new Error("offline")), "2026-05-04")
      )
    );

    expect(
      Result.match(outcome, {
        onFailure: (failure) => failure.message,
        onSuccess: () => "",
      })
    ).toBe("The European Central Bank rates could not be read: Error: offline");
  });
});
