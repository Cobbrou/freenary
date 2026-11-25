import { afterAll, describe, expect, it } from "bun:test";

import { localDayOfBankDate } from "@/shared/lib/calendar-day";

import { reportingTotalOf, upcomingPayments } from "./upcoming-payments";
import type { RecurringItem } from "./upcoming-payments";

const HORIZON_DAYS = 30;

const item = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  amountSpread: 0,
  category: "subscriptions",
  confidence: "confirmed",
  currency: "EUR",
  frequency: "monthly",
  intervalDays: 30,
  kind: "fixed",
  lastSeen: "2026-08-05T00:00:00.000Z",
  merchantKey: "netflix",
  merchantName: "Netflix",
  nextExpected: "2026-09-04T00:00:00.000Z",
  occurrences: 6,
  reportingAmountMinor: overrides.typicalAmountMinor ?? 1000,
  typicalAmountMinor: 1000,
  ...overrides,
});

describe("upcomingPayments", () => {
  const asOf = new Date(2026, 8, 8);

  it("rolls a next date already behind today onto its next slot rather than reporting it as due now", () => {
    const staleNextExpected = item({
      nextExpected: new Date(2026, 7, 3).toISOString(),
    });

    const [first] = upcomingPayments([staleNextExpected], asOf, HORIZON_DAYS);

    expect(first?.date).toEqual(new Date(2026, 9, 2));
    expect(first?.daysAway).toBe(24);
  });

  it("counts a payment due today as zero days away", () => {
    const today = item({ nextExpected: new Date(2026, 8, 8).toISOString() });

    expect(upcomingPayments([today], asOf, HORIZON_DAYS)[0]?.daysAway).toBe(0);
  });

  it("emits every occurrence a weekly cadence fits in the horizon", () => {
    const weekly = item({
      frequency: "weekly",
      intervalDays: 7,
      nextExpected: new Date(2026, 8, 9).toISOString(),
    });

    expect(
      upcomingPayments([weekly], asOf, HORIZON_DAYS).map((p) => p.daysAway)
    ).toEqual([1, 8, 15, 22, 29]);
  });

  it("excludes an occurrence past the horizon and keeps one on it", () => {
    const onEdge = item({ nextExpected: new Date(2026, 9, 8).toISOString() });
    const beyond = item({
      merchantKey: "gym",
      nextExpected: new Date(2026, 9, 9).toISOString(),
    });

    expect(upcomingPayments([onEdge, beyond], asOf, HORIZON_DAYS)).toHaveLength(
      1
    );
  });

  it("orders occurrences from several patterns by date", () => {
    const later = item({ nextExpected: new Date(2026, 8, 20).toISOString() });
    const sooner = item({
      merchantKey: "rent",
      merchantName: "Landlord",
      nextExpected: new Date(2026, 8, 10).toISOString(),
    });

    expect(
      upcomingPayments([later, sooner], asOf, HORIZON_DAYS).map((p) => p.label)
    ).toEqual(["Landlord", "Netflix"]);
  });

  it("drops an occurrence whose cadence exhausts the projection cap before reaching today", () => {
    const stalledAYearBackOnAFiveDayCadence = item({
      frequency: "weekly",
      intervalDays: 5,
      nextExpected: new Date(2025, 8, 15).toISOString(),
    });

    expect(
      upcomingPayments([stalledAYearBackOnAFiveDayCadence], asOf, HORIZON_DAYS)
    ).toEqual([]);
  });
});

describe("reportingTotalOf", () => {
  const asOf = new Date(2026, 8, 8);

  it("adds each payment in the reporting currency and counts the ones without a rate", () => {
    const upcoming = upcomingPayments(
      [
        item({ nextExpected: "2026-09-10T00:00:00.000Z" }),
        item({
          currency: "USD",
          merchantKey: "hosting",
          nextExpected: "2026-09-12T00:00:00.000Z",
          reportingAmountMinor: 920,
          typicalAmountMinor: 1000,
        }),
        item({
          currency: "XYZ",
          merchantKey: "club",
          nextExpected: "2026-09-14T00:00:00.000Z",
          reportingAmountMinor: null,
          typicalAmountMinor: 5000,
        }),
      ],
      asOf,
      HORIZON_DAYS
    );

    expect(reportingTotalOf(upcoming)).toEqual({
      includedCount: 2,
      totalMinor: 1920,
      unconvertedCount: 1,
    });
  });
});

describe("bank dates west and east of UTC", () => {
  const HOST_TZ = process.env.TZ;
  const dueToday = item({ nextExpected: "2026-09-08T00:00:00.000Z" });

  afterAll(() => {
    if (HOST_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = HOST_TZ;
    }
  });

  it.each([
    ["America/Martinique", "2026-09-08T14:00:00.000Z", 240],
    ["Europe/Paris", "2026-09-08T08:00:00.000Z", -120],
  ])(
    "counts a payment due today as zero days away in %s",
    (timeZone, asOf, offsetMinutes) => {
      process.env.TZ = timeZone;

      expect(new Date(asOf).getTimezoneOffset()).toBe(offsetMinutes);
      expect(localDayOfBankDate(dueToday.nextExpected).getDate()).toBe(8);
      expect(
        upcomingPayments([dueToday], new Date(asOf), HORIZON_DAYS)[0]?.daysAway
      ).toBe(0);
    }
  );

  it("keeps a weekly payment on its weekday across the switch to summer time", () => {
    process.env.TZ = "Europe/Paris";
    const weekly = item({
      frequency: "weekly",
      intervalDays: 7,
      nextExpected: "2026-03-26T00:00:00.000Z",
    });

    const upcoming = upcomingPayments([weekly], new Date(2026, 2, 26), 14);

    expect(upcoming.map((p) => p.date)).toEqual([
      new Date(2026, 2, 26),
      new Date(2026, 3, 2),
      new Date(2026, 3, 9),
    ]);

    expect(upcoming.map((p) => p.daysAway)).toEqual([0, 7, 14]);
  });
});
