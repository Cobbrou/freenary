import { afterAll, afterEach, expect, it, setSystemTime } from "bun:test";

import { m } from "@/paraglide/messages.js";

import { computeDateRange, formatPeriodLabel } from "./period";
import { formatGroupLabel, groupKey } from "./transaction-groups";

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

  const { from, to } = computeDateRange(2026, OCTOBER, "1M");
  const bankDate = new Date(FIRST_OF_OCTOBER);

  expect(bankDate >= from && bankDate <= to).toBe(true);
  expect(formatPeriodLabel(from, to, "1M", "en")).toBe("October 2026");
});

it("groups a bank date of the 1st under the 1st west of UTC", () => {
  expect(groupKey(FIRST_OF_OCTOBER, "1M")).toBe("2026-10-01");
  expect(groupKey(FIRST_OF_OCTOBER, "1Y")).toBe("2026-10");
});

it("labels today's bank date as today just after midnight in Paris", () => {
  process.env.TZ = "Europe/Paris";
  setSystemTime(new Date("2026-10-25T23:30:00.000Z"));

  const key = groupKey("2026-10-26T00:00:00.000Z", "1M");

  expect(formatGroupLabel(key, "1M", "en")).toBe(m.budget_group_today());
});
