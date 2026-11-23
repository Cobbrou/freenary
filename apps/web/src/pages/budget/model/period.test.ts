import { afterAll, afterEach, expect, it, setSystemTime } from "bun:test";

import { CALENDAR_BUDGET_MONTH } from "@freenary/api/lib/budget-month";

import { computeDateRange, formatPeriodLabel } from "./period";

const FIRST_OF_OCTOBER = "2026-10-01T00:00:00.000Z";
const OCTOBER = 9;
const MARTINIQUE_OFFSET_MINUTES = 240;
const HOST_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = "America/Martinique";
  setSystemTime();
});

afterAll(() => {
  if (HOST_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = HOST_TZ;
  }
});

process.env.TZ = "America/Martinique";

it("counts a bank date of the 1st in its own month west of UTC", () => {
  expect(new Date(2026, OCTOBER, 1).getTimezoneOffset()).toBe(
    MARTINIQUE_OFFSET_MINUTES
  );

  const { from, to } = computeDateRange(
    2026,
    OCTOBER,
    "1M",
    CALENDAR_BUDGET_MONTH
  );

  const bankDate = new Date(FIRST_OF_OCTOBER);

  expect(bankDate >= from && bankDate <= to).toBe(true);
  expect(formatPeriodLabel({ month: OCTOBER, year: 2026 }, "1M", "en")).toBe(
    "October 2026"
  );
});
