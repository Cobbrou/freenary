import { describe, expect, it } from "bun:test";

import { fitSideLabel } from "./side-label";

const DIGIT = /\d/u;

const amountWholeOrAbsent = (fitted: string, value: string) =>
  fitted.includes(value) || !DIGIT.test(fitted);

const LEADING_SYMBOL_AMOUNTS = [
  "€2,500.00",
  "€216.40",
  "€95.00",
  "€1.00",
  "€1,234,567.89",
];

const TRAILING_SYMBOL_AMOUNTS = ["2\u202F500,00\u00A0€", "216,40\u00A0€"];

const DIGIT_FREE_LABELS = [
  "Salary",
  "Public transport",
  "Culture & events",
  "Rent",
];

const PRE_FIX_RENDERS_THAT_SLICED_THE_AMOUNT = [
  ["Salary: €2…", "€2,500.00"],
  ["Culture & events: €95.…", "€95.00"],
  ["Public transport: €216…", "€216.40"],
  ["Salary: 216,4…", "216,40\u00A0€"],
] as const;

const WIDEST_TESTED_LABEL_CHARS = 40;

describe("fitSideLabel", () => {
  it("keeps both when they fit", () => {
    expect(fitSideLabel("Rent", "€1,080.00", 20)).toBe("Rent: €1,080.00");
  });

  it("trims the label, never the amount", () => {
    const fitted = fitSideLabel("Public transport", "€216.40", 23);

    expect(fitted).toBe("Public transp…: €216.40");
  });

  it("drops the amount whole rather than slicing it to €2…", () => {
    expect(fitSideLabel("Salary", "€2,500.00", 11)).toBe("Salary");
  });

  it("would reject the outputs the old slicing produced", () => {
    for (const [broken, value] of PRE_FIX_RENDERS_THAT_SLICED_THE_AMOUNT) {
      expect(amountWholeOrAbsent(broken, value)).toBe(false);
    }
  });

  it("never emits a partial amount, wherever the symbol sits", () => {
    const amounts = [...LEADING_SYMBOL_AMOUNTS, ...TRAILING_SYMBOL_AMOUNTS];

    for (const label of DIGIT_FREE_LABELS) {
      for (const value of amounts) {
        for (
          let maxChars = 0;
          maxChars <= WIDEST_TESTED_LABEL_CHARS;
          maxChars += 1
        ) {
          const fitted = fitSideLabel(label, value, maxChars);

          if (fitted === null) {
            continue;
          }

          expect(amountWholeOrAbsent(fitted, value)).toBe(true);
          expect(fitted.length).toBeLessThanOrEqual(maxChars);
        }
      }
    }
  });

  it("truncates a label too long to fit on its own", () => {
    expect(fitSideLabel("Extraordinarily long name", "€5.00", 10)).toBe(
      "Extraordi…"
    );
  });

  it("returns null when nothing useful fits", () => {
    expect(fitSideLabel("Rent", "€1.00", 4)).toBeNull();
    expect(fitSideLabel("Rent", "€1.00", 0)).toBeNull();
  });
});
