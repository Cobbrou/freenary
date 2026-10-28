import { describe, expect, it } from "bun:test";

import { localDay } from "./prompt";
import { DAY } from "./tools";

describe("localDay", () => {
  it("reads the calendar day in the local time zone", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("DAY", () => {
  it("refuses a day that does not exist", () => {
    expect(DAY.safeParse("2026-13-45").success).toBe(false);
    expect(DAY.safeParse("2026-02-29").success).toBe(false);
  });

  it("accepts a real day", () => {
    expect(DAY.safeParse("2028-02-29").success).toBe(true);
  });
});
