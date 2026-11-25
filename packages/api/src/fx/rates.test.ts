import { describe, expect, it } from "bun:test";

import { missingRateRanges } from "./rates";

const TODAY = new Date("2026-05-10T12:00:00Z");

describe("missingRateRanges", () => {
  it("fetches everything from the earliest day needed when nothing is stored", () => {
    expect(
      missingRateRanges(
        { earliest: null, latest: null },
        new Date("2024-03-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([{ startDay: "2024-03-01" }]);
  });

  it("never asks for a day before the first ECB rate", () => {
    expect(
      missingRateRanges(
        { earliest: null, latest: null },
        new Date("1990-06-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([{ startDay: "1999-01-04" }]);
  });

  it("backfills up to the day before the earliest stored rate", () => {
    expect(
      missingRateRanges(
        {
          earliest: new Date("2025-01-02T00:00:00Z"),
          latest: new Date("2026-05-10T00:00:00Z"),
        },
        new Date("2024-03-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([{ endDay: "2025-01-01", startDay: "2024-03-01" }]);
  });

  it("fetches forward from the day after the latest stored rate", () => {
    expect(
      missingRateRanges(
        {
          earliest: new Date("2024-03-01T00:00:00Z"),
          latest: new Date("2026-05-07T00:00:00Z"),
        },
        new Date("2024-03-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([{ startDay: "2026-05-08" }]);
  });

  it("does both when the stored rates sit inside the needed span", () => {
    expect(
      missingRateRanges(
        {
          earliest: new Date("2025-01-02T00:00:00Z"),
          latest: new Date("2026-05-07T00:00:00Z"),
        },
        new Date("2024-03-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([
      { endDay: "2025-01-01", startDay: "2024-03-01" },
      { startDay: "2026-05-08" },
    ]);
  });

  it("asks for nothing when the stored rates cover the span", () => {
    expect(
      missingRateRanges(
        {
          earliest: new Date("2024-01-01T00:00:00Z"),
          latest: new Date("2026-05-10T00:00:00Z"),
        },
        new Date("2024-03-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([]);
  });

  it("does not backfill before 1999-01-04 when the earliest rate is that day", () => {
    expect(
      missingRateRanges(
        {
          earliest: new Date("1999-01-04T00:00:00Z"),
          latest: new Date("2026-05-10T00:00:00Z"),
        },
        new Date("1990-01-01T00:00:00Z"),
        TODAY
      )
    ).toEqual([]);
  });
});
