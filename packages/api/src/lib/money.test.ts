import { describe, expect, test } from "bun:test";

import { fromMinor, minorUnitDigits, toMinor } from "./money";

describe("money", () => {
  test("reads the minor-unit digits from the currency", () => {
    expect(minorUnitDigits("EUR")).toBe(2);
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KWD")).toBe(3);
  });

  test("converts between minor units and the decimal amount", () => {
    expect(fromMinor(1250, "EUR")).toBe(12.5);
    expect(fromMinor(1250, "JPY")).toBe(1250);
    expect(toMinor(12.5, "EUR")).toBe(1250);
    expect(toMinor(1.2345, "KWD")).toBe(1235);
  });
});
