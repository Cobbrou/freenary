import { describe, expect, it } from "bun:test";

import { REFERENCE_CURRENCY, rateBookOf } from "./rate-book";

const FRIDAY = new Date("2026-05-01T00:00:00Z");
const SATURDAY = new Date("2026-05-02T15:00:00Z");
const MONDAY = new Date("2026-05-04T00:00:00Z");

const book = rateBookOf([
  { currency: "USD", date: MONDAY, ratePerEur: 1.2 },
  { currency: "USD", date: FRIDAY, ratePerEur: 1.1 },
  { currency: "GBP", date: FRIDAY, ratePerEur: 0.85 },
  { currency: "JPY", date: FRIDAY, ratePerEur: 160 },
  { currency: "KWD", date: FRIDAY, ratePerEur: 0.33 },
  { currency: "CHF", date: FRIDAY, ratePerEur: 1.5 },
]);

describe("rateBookOf", () => {
  it("rates the euro at one on any day", () => {
    expect(REFERENCE_CURRENCY).toBe("EUR");
    expect(book.rateOn("EUR", new Date("1990-01-01T00:00:00Z"))).toBe(1);
  });

  it("uses the last rate published on or before the day", () => {
    expect(book.rateOn("USD", FRIDAY)).toBe(1.1);
    expect(book.rateOn("USD", SATURDAY)).toBe(1.1);
    expect(book.rateOn("USD", MONDAY)).toBe(1.2);
    expect(book.rateOn("USD", new Date("2026-06-30T00:00:00Z"))).toBe(1.2);
  });

  it("has no rate before the first one or for an unknown currency", () => {
    expect(book.rateOn("USD", new Date("2026-04-30T00:00:00Z"))).toBeNull();
    expect(book.rateOn("SEK", MONDAY)).toBeNull();
    expect(
      book.convert(1000, "USD", "EUR", new Date("2026-04-30T00:00:00Z"))
    ).toBeNull();

    expect(book.convert(1000, "EUR", "SEK", MONDAY)).toBeNull();
  });

  it("returns the amount unchanged within one currency, even with no rate", () => {
    expect(book.convert(1234, "SEK", "SEK", MONDAY)).toBe(1234);
  });

  it("converts to and from the euro", () => {
    expect(book.convert(1000, "EUR", "USD", SATURDAY)).toBe(1100);
    expect(book.convert(1200, "USD", "EUR", MONDAY)).toBe(1000);
  });

  it("crosses two currencies through the euro", () => {
    expect(book.convert(1100, "USD", "GBP", SATURDAY)).toBe(850);
  });

  it("follows the minor units of each currency", () => {
    expect(book.convert(1000, "EUR", "JPY", FRIDAY)).toBe(1600);
    expect(book.convert(1600, "JPY", "EUR", FRIDAY)).toBe(1000);
    expect(book.convert(1000, "EUR", "KWD", FRIDAY)).toBe(3300);
    expect(book.convert(1600, "JPY", "KWD", FRIDAY)).toBe(3300);
  });

  it("rounds once and the same way for a debit and a credit", () => {
    expect(book.convert(1, "EUR", "CHF", FRIDAY)).toBe(2);
    expect(book.convert(-1, "EUR", "CHF", FRIDAY)).toBe(-2);
    expect(book.convert(-1000, "EUR", "USD", SATURDAY)).toBe(-1100);
  });

  it("dates the book by its latest rate", () => {
    expect(book.latestDate).toEqual(MONDAY);
    expect(rateBookOf([]).latestDate).toBeNull();
  });
});
