import { describe, expect, test } from "bun:test";

import {
  budgetMonthKey,
  budgetMonthKeysBetween,
  budgetMonthOfBankDate,
  budgetMonthOfDay,
  budgetMonthRange,
  budgetMonthsRange,
  budgetMonthStartDaySchema,
  shiftBudgetMonth,
} from "./budget-month";
import type { BudgetMonthRule } from "./budget-month";

const JANUARY = 0;
const FEBRUARY = 1;
const MARCH = 2;
const APRIL = 3;
const MAY = 4;
const JUNE = 5;
const DECEMBER = 11;

const onDay = (startDay: number): BudgetMonthRule => ({
  anchor: "DAY_OF_MONTH",
  startDay,
});

const LAST_DAY: BudgetMonthRule = { anchor: "LAST_DAY" };

const lastWorkingDay = (country: string | null): BudgetMonthRule => ({
  anchor: "LAST_WORKING_DAY",
  country,
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const isoRange = ({ from, to }: { from: Date; to: Date }) => [
  from.toISOString(),
  to.toISOString(),
];

describe("budgetMonthRange on a day of the month", () => {
  test("is the calendar month when the month starts on the 1st", () => {
    expect(
      isoRange(budgetMonthRange({ month: FEBRUARY, year: 2026 }, onDay(1)))
    ).toEqual(["2026-02-01T00:00:00.000Z", "2026-02-28T23:59:59.999Z"]);
  });

  test("starts in the named month up to the 15th", () => {
    expect(
      isoRange(budgetMonthRange({ month: JANUARY, year: 2026 }, onDay(5)))
    ).toEqual(["2026-01-05T00:00:00.000Z", "2026-02-04T23:59:59.999Z"]);
  });

  test("starts in the month before from the 16th", () => {
    expect(
      isoRange(budgetMonthRange({ month: FEBRUARY, year: 2026 }, onDay(28)))
    ).toEqual(["2026-01-28T00:00:00.000Z", "2026-02-27T23:59:59.999Z"]);
  });

  test("crosses the year boundary", () => {
    expect(
      isoRange(budgetMonthRange({ month: JANUARY, year: 2026 }, onDay(25)))
    ).toEqual(["2025-12-25T00:00:00.000Z", "2026-01-24T23:59:59.999Z"]);
  });
});

describe("budgetMonthRange on the last day", () => {
  test("follows the length of each month", () => {
    expect(
      isoRange(budgetMonthRange({ month: MARCH, year: 2027 }, LAST_DAY))
    ).toEqual(["2027-02-28T00:00:00.000Z", "2027-03-30T23:59:59.999Z"]);
  });

  test("starts on February 29 in a leap year", () => {
    expect(
      isoRange(budgetMonthRange({ month: MARCH, year: 2028 }, LAST_DAY))
    ).toEqual(["2028-02-29T00:00:00.000Z", "2028-03-30T23:59:59.999Z"]);
  });
});

describe("budgetMonthRange on the last working day", () => {
  test("moves back to Friday when the month ends on a weekend", () => {
    expect(
      isoRange(
        budgetMonthRange({ month: JUNE, year: 2026 }, lastWorkingDay("FR"))
      )
    ).toEqual(["2026-05-29T00:00:00.000Z", "2026-06-29T23:59:59.999Z"]);
  });

  test("skips a public holiday of the chosen country", () => {
    const withoutCountry = budgetMonthRange(
      { month: APRIL, year: 2024 },
      lastWorkingDay(null)
    ).from;

    const goodFridayInGermany = budgetMonthRange(
      { month: APRIL, year: 2024 },
      lastWorkingDay("DE")
    ).from;

    expect(withoutCountry.toISOString()).toBe("2024-03-29T00:00:00.000Z");
    expect(goodFridayInGermany.toISOString()).toBe("2024-03-28T00:00:00.000Z");
  });

  test("keeps a working last day, February 29 included", () => {
    expect(
      budgetMonthRange(
        { month: MARCH, year: 2028 },
        lastWorkingDay("FR")
      ).from.toISOString()
    ).toBe("2028-02-29T00:00:00.000Z");
  });
});

describe("budgetMonthOfDay", () => {
  test("places every day of a period in the month that names it", () => {
    const rules = [
      onDay(1),
      onDay(5),
      onDay(15),
      onDay(16),
      onDay(28),
      LAST_DAY,
      lastWorkingDay("FR"),
    ];

    for (const rule of rules) {
      for (const month of [JANUARY, FEBRUARY, MARCH, MAY, DECEMBER]) {
        const named = { month, year: 2028 };
        const { from, to } = budgetMonthRange(named, rule);

        expect(budgetMonthOfBankDate(from, rule)).toEqual(named);
        expect(budgetMonthOfBankDate(to, rule)).toEqual(named);
      }
    }
  });

  test("moves a salary paid on the last working day to the next month", () => {
    expect(
      budgetMonthOfBankDate(day("2026-05-29"), lastWorkingDay("FR"))
    ).toEqual({
      month: JUNE,
      year: 2026,
    });

    expect(
      budgetMonthOfBankDate(day("2026-05-28"), lastWorkingDay("FR"))
    ).toEqual({
      month: MAY,
      year: 2026,
    });
  });

  test("keeps a day before the start in the previous period", () => {
    expect(
      budgetMonthOfDay({ date: 4, month: JANUARY, year: 2026 }, onDay(5))
    ).toEqual({
      month: DECEMBER,
      year: 2025,
    });
  });
});

describe("budgetMonthsRange and budgetMonthKeysBetween", () => {
  test("span several budget months ending on the given one", () => {
    const range = budgetMonthsRange(
      { month: FEBRUARY, year: 2026 },
      3,
      onDay(25)
    );

    expect(isoRange(range)).toEqual([
      "2025-11-25T00:00:00.000Z",
      "2026-02-24T23:59:59.999Z",
    ]);

    expect(budgetMonthKeysBetween(range.from, range.to, onDay(25))).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("shiftBudgetMonth and budgetMonthKey", () => {
  test("wrap around the year", () => {
    expect(
      budgetMonthKey(shiftBudgetMonth({ month: JANUARY, year: 2026 }, -1))
    ).toBe("2025-12");

    expect(
      budgetMonthKey(shiftBudgetMonth({ month: DECEMBER, year: 2025 }, 2))
    ).toBe("2026-02");
  });
});

describe("budgetMonthStartDaySchema", () => {
  test("accepts the 1st to the 28th only", () => {
    expect(budgetMonthStartDaySchema.safeParse(1).success).toBe(true);
    expect(budgetMonthStartDaySchema.safeParse(28).success).toBe(true);
    expect(budgetMonthStartDaySchema.safeParse(0).success).toBe(false);
    expect(budgetMonthStartDaySchema.safeParse(29).success).toBe(false);
  });
});
