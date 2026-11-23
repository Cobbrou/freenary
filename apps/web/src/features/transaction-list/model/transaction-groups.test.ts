import { afterAll, afterEach, expect, it, setSystemTime } from "bun:test";

import { m } from "@/paraglide/messages.js";

import {
  buildVirtualItems,
  formatGroupLabel,
  groupKey,
} from "./transaction-groups";

const FIRST_OF_OCTOBER = "2026-10-01T00:00:00.000Z";
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

it("groups a bank date of the 1st under the 1st west of UTC", () => {
  expect(groupKey(FIRST_OF_OCTOBER, "day")).toBe("2026-10-01");
  expect(groupKey(FIRST_OF_OCTOBER, "month")).toBe("2026-10");
});

it("labels today's bank date as today just after midnight in Paris", () => {
  process.env.TZ = "Europe/Paris";
  setSystemTime(new Date("2026-10-25T23:30:00.000Z"));

  const key = groupKey("2026-10-26T00:00:00.000Z", "day");

  expect(formatGroupLabel(key, "day", "en")).toBe(m.budget_group_today());
});

const transactionOn = (id: string, date: string, amount: number) => ({
  amount,
  category: "groceries" as const,
  counterpartyName: id,
  currency: "EUR",
  date,
  derivedCategory: "groceries" as const,
  description: id,
  id,
  normalisedDescriptor: id,
});

it("keys every header apart when a day heads two groups", () => {
  const items = buildVirtualItems(
    [
      transactionOn("a", "2026-10-05T00:00:00.000Z", -90),
      transactionOn("b", "2026-10-06T00:00:00.000Z", -50),
      transactionOn("c", "2026-10-05T00:00:00.000Z", -10),
    ],
    "day",
    "en"
  );

  const keys = items.map((item) => item.key);

  expect(new Set(keys).size).toBe(keys.length);
});
