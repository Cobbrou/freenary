import { describe, expect, test } from "bun:test";

import { parseAmountBound } from "./amount-bound";

describe("parseAmountBound", () => {
  test("reads a plain number in either locale", () => {
    expect(parseAmountBound("1234.56", "en")).toBe(1234.56);
    expect(parseAmountBound("1234,56", "fr")).toBe(1234.56);
  });

  test("reads back a grouped amount as the list renders it", () => {
    expect(parseAmountBound("1,234.56", "en")).toBe(1234.56);
    expect(parseAmountBound("1\u202F234,56", "fr")).toBe(1234.56);
    expect(parseAmountBound("1 234,56", "fr")).toBe(1234.56);
  });

  test("a group separator is not a decimal point", () => {
    expect(parseAmountBound("1,234", "en")).toBe(1234);
    expect(parseAmountBound("1,234", "fr")).toBe(1.234);
  });

  test("a decimal dot still reads under a comma locale", () => {
    expect(parseAmountBound("12.50", "fr")).toBe(12.5);
  });

  test("no bound where there is no number", () => {
    expect(parseAmountBound("", "en")).toBe(0);
    expect(parseAmountBound("abc", "en")).toBe(0);
    expect(parseAmountBound("-40", "en")).toBe(40);
    expect(parseAmountBound("0", "en")).toBe(0);
  });
});
