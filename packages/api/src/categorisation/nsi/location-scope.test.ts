import { describe, expect, it } from "bun:test";

import { resolveNsiCountries } from "./location-scope";

const UN_M49_REGION_CODES = {
  "001": "world",
  "150": "Europe",
  "419": "Latin America",
} as const satisfies Record<string, string>;

const AMBIGUOUS_NSI_CODE_MEANING_JAPAN_OR_JAMAICA = "ja";
const NON_ISO_NSI_COUNTRY_CODES = ["el", "ra", "pi", "kv"];
const MALFORMED_REGION_SUBTAGS = ["12", "1a", "a1", "--", "f-", "é!"];

describe("resolveNsiCountries", () => {
  it("reads plain ISO country codes", () => {
    expect(resolveNsiCountries(["fr", "be", "lu"])).toEqual(["BE", "FR", "LU"]);
  });

  it("folds metropolitan France onto FR", () => {
    expect(resolveNsiCountries(["fx"])).toEqual(["FR"]);
    expect(resolveNsiCountries(["fr", "fx"])).toEqual(["FR"]);
  });

  it("takes the country from a subdivision or region file", () => {
    expect(resolveNsiCountries(["gb-eng", "gb-sct"])).toEqual(["GB"]);
    expect(resolveNsiCountries(["fr-ara.geojson"])).toEqual(["FR"]);
    expect(resolveNsiCountries(["us-hi", "us-ak"])).toEqual(["US"]);
  });

  it("refuses codes that name no single country", () => {
    expect(resolveNsiCountries(Object.keys(UN_M49_REGION_CODES))).toEqual([]);
    expect(resolveNsiCountries(["conus", "northern cyprus"])).toEqual([]);
    expect(resolveNsiCountries([{ coordinates: [], type: "Polygon" }])).toEqual(
      []
    );
  });

  it("refuses NSI's non-ISO country codes rather than guessing", () => {
    expect(
      resolveNsiCountries([AMBIGUOUS_NSI_CODE_MEANING_JAPAN_OR_JAMAICA])
    ).toEqual([]);

    expect(resolveNsiCountries(NON_ISO_NSI_COUNTRY_CODES)).toEqual([]);
  });

  it("keeps the countries it can read when a set mixes shapes", () => {
    expect(
      resolveNsiCountries(["fr", "ja", "001", "gb-eng", "conus", "fx"])
    ).toEqual(["FR", "GB"]);
  });

  it("treats an absent or empty scope as unscoped", () => {
    expect(resolveNsiCountries()).toEqual([]);
    expect(resolveNsiCountries([])).toEqual([]);
  });

  it("refuses malformed two-character tokens instead of throwing", () => {
    for (const token of MALFORMED_REGION_SUBTAGS) {
      expect(resolveNsiCountries([token])).toEqual([]);
    }
  });
});
