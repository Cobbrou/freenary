import { describe, expect, it } from "bun:test";

import type { RecurringData, RecurringItem } from "@/entities/recurring";

import {
  annualCostMinor,
  forecastSeries,
  monthlyEquivalentMinor,
  recurringInsights,
  recurringSections,
  recurringSummary,
  recurringTrend,
} from "./recurring";
import type { RecurringMonth } from "./recurring";

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

const month = (
  key: string,
  fixedMinor: number,
  behavioralMinor = 0,
  discretionaryMinor = 0
): RecurringMonth => ({
  behavioralMinor,
  discretionaryMinor,
  fixedMinor,
  month: key,
});

const recurringData = (
  overrides: Partial<RecurringData> = {}
): RecurringData => ({
  asOf: "2026-09-08T10:00:00.000Z",
  availableBalanceMinor: null,
  currency: "EUR",
  items: [],
  monthly: [],
  monthlyIncomeMinor: null,
  plannedOutgoingMinor: null,
  unconvertedBalanceCount: 0,
  unconvertedCount: 0,
  ...overrides,
});

describe("cost of a cadence", () => {
  it("scales a weekly payment up and a yearly one down", () => {
    const weekly = item({ intervalDays: 7, typicalAmountMinor: 500 });
    const yearly = item({ intervalDays: 365, typicalAmountMinor: 12_000 });

    expect(monthlyEquivalentMinor(weekly)).toBe(2174);
    expect(annualCostMinor(weekly)).toBe(26_089);
    expect(monthlyEquivalentMinor(yearly)).toBe(1001);
    expect(annualCostMinor(yearly)).toBe(12_008);
  });

  it("costs nothing rather than infinity at a cadence of zero days", () => {
    const broken = item({ intervalDays: 0 });

    expect(monthlyEquivalentMinor(broken)).toBe(0);
    expect(annualCostMinor(broken)).toBe(0);
  });
});

describe("recurringSummary", () => {
  const asOf = new Date(2026, 8, 8);

  it("totals commitments only, and counts patterns beside them", () => {
    const summary = recurringSummary(
      recurringData({
        items: [
          item({ typicalAmountMinor: 1000 }),
          item({ merchantKey: "rent", typicalAmountMinor: 90_000 }),
          item({
            amountSpread: 0.6,
            confidence: "pattern",
            kind: "behavioral",
            merchantKey: "grocer",
            typicalAmountMinor: 4000,
          }),
        ],
      }),
      asOf
    );

    expect(summary.activeCount).toBe(2);
    expect(summary.behavioralCount).toBe(1);
    expect(summary.monthlyMinor).toBe(92_328);
  });

  it("prefers a declared plan over observed income as the denominator", () => {
    const withBoth = recurringSummary(
      recurringData({
        items: [item({ typicalAmountMinor: 50_000 })],
        monthlyIncomeMinor: 400_000,
        plannedOutgoingMinor: 200_000,
      }),
      asOf
    );

    expect(withBoth.denominatorKind).toBe("plan");
    expect(withBoth.share).toBeCloseTo(0.2536, 3);
    expect(withBoth.remainingMinor).toBe(200_000 - withBoth.monthlyMinor);
  });

  it("falls back to observed income when no plan is declared", () => {
    const summary = recurringSummary(
      recurringData({ items: [item()], monthlyIncomeMinor: 400_000 }),
      asOf
    );

    expect(summary.denominatorKind).toBe("income");
  });

  it("reports no share at all rather than a share of zero", () => {
    const summary = recurringSummary(
      recurringData({
        items: [item()],
        monthlyIncomeMinor: 0,
        plannedOutgoingMinor: 0,
      }),
      asOf
    );

    expect(summary.denominatorKind).toBeNull();
    expect(summary.remainingMinor).toBeNull();
    expect(summary.share).toBeNull();
  });

  it("totals commitments in other currencies at their converted amount, and counts the ones without a rate", () => {
    const summary = recurringSummary(
      recurringData({
        items: [
          item({ nextExpected: "2026-09-10T00:00:00.000Z" }),
          item({
            currency: "USD",
            merchantKey: "hosting",
            nextExpected: "2026-09-12T00:00:00.000Z",
            reportingAmountMinor: 900,
            typicalAmountMinor: 1000,
          }),
          item({
            currency: "XYZ",
            merchantKey: "club",
            nextExpected: "2026-09-14T00:00:00.000Z",
            reportingAmountMinor: null,
            typicalAmountMinor: 50_000,
          }),
        ],
      }),
      asOf
    );

    expect(summary.activeCount).toBe(3);
    expect(summary.monthlyMinor).toBe(1015 + 913);
    expect(summary.upcomingMinor).toBe(1900);
    expect(summary.upcomingCount).toBe(2);
    expect(summary.unconvertedItemCount).toBe(1);
  });

  it("separates what falls due this week from the whole horizon", () => {
    const summary = recurringSummary(
      recurringData({
        items: [
          item({ nextExpected: new Date(2026, 8, 10).toISOString() }),
          item({
            merchantKey: "rent",
            nextExpected: new Date(2026, 8, 30).toISOString(),
          }),
        ],
      }),
      asOf
    );

    expect(summary.dueSoonCount).toBe(1);
    expect(summary.upcomingCount).toBe(2);
  });
});

describe("forecastSeries", () => {
  const asOf = new Date(2026, 8, 8);

  it("has nothing to draw when no account reported a balance", () => {
    expect(
      forecastSeries(recurringData({ items: [item()] }), asOf)
    ).toHaveLength(0);
  });

  it("walks the balance down as each payment lands", () => {
    const points = forecastSeries(
      recurringData({
        availableBalanceMinor: 100_000,
        items: [
          item({ nextExpected: new Date(2026, 8, 10).toISOString() }),
          item({
            merchantKey: "rent",
            nextExpected: new Date(2026, 8, 10).toISOString(),
            typicalAmountMinor: 90_000,
          }),
        ],
      }),
      asOf,
      5
    );

    expect(points).toHaveLength(6);
    expect(points[0]?.balanceMinor).toBe(100_000);
    expect(points[2]?.dueMinor).toBe(91_000);
    expect(points[2]?.balanceMinor).toBe(9000);
    expect(points.at(-1)?.balanceMinor).toBe(9000);
  });

  it("draws a payment in another currency at its converted amount and skips one without a rate", () => {
    const points = forecastSeries(
      recurringData({
        availableBalanceMinor: 100_000,
        items: [
          item({
            currency: "USD",
            nextExpected: "2026-09-09T00:00:00.000Z",
            reportingAmountMinor: 9000,
            typicalAmountMinor: 10_000,
          }),
          item({
            currency: "XYZ",
            merchantKey: "club",
            nextExpected: "2026-09-09T00:00:00.000Z",
            reportingAmountMinor: null,
            typicalAmountMinor: 50_000,
          }),
        ],
      }),
      asOf,
      2
    );

    expect(points[1]?.dueMinor).toBe(9000);
    expect(points[1]?.labels).toEqual(["Netflix"]);
    expect(points.at(-1)?.balanceMinor).toBe(91_000);
  });

  it("goes negative rather than clamping, because that is the warning", () => {
    const points = forecastSeries(
      recurringData({
        availableBalanceMinor: 5000,
        items: [
          item({
            nextExpected: new Date(2026, 8, 9).toISOString(),
            typicalAmountMinor: 90_000,
          }),
        ],
      }),
      asOf,
      3
    );

    expect(points[1]?.balanceMinor).toBe(-85_000);
  });
});

describe("recurringTrend", () => {
  it("drops the month in progress instead of reading it as a collapse", () => {
    const flat = Array.from({ length: 6 }, (_, i) =>
      month(`2026-0${i + 1}`, 10_000)
    );

    const withPartial = [...flat, month("2026-07", 500)];

    expect(recurringTrend(withPartial)?.direction).toBe("flat");
  });

  it("reports the direction and the size of a real move", () => {
    const monthly = [
      month("2026-01", 10_000),
      month("2026-02", 10_000),
      month("2026-03", 10_000),
      month("2026-04", 11_000),
      month("2026-05", 10_600),
      month("2026-06", 10_800),
      month("2026-07", 0),
    ];

    const trend = recurringTrend(monthly);

    expect(trend?.direction).toBe("up");
    expect(trend?.ratio).toBeCloseTo(0.08, 2);
  });

  it("counts repeated purchases as recurring alongside commitments", () => {
    const monthly = [
      month("2026-01", 5000, 5000),
      month("2026-02", 5000, 5000),
      month("2026-03", 5000, 5000),
      month("2026-04", 5000, 10_000),
      month("2026-05", 5000, 10_000),
      month("2026-06", 5000, 10_000),
      month("2026-07", 0),
    ];

    expect(recurringTrend(monthly)?.ratio).toBeCloseTo(0.5, 3);
  });

  it("has no trend without two whole windows to compare", () => {
    expect(recurringTrend([month("2026-01", 10_000)])).toBeNull();
  });

  it("refuses a comparison window whose earlier half is zero-filled months from before the history", () => {
    const zeroFilledBeforeTheHistoryBegins = [
      month("2026-01", 0),
      month("2026-02", 0),
    ];

    const monthly = [
      ...zeroFilledBeforeTheHistoryBegins,
      month("2026-03", 10_000),
      month("2026-04", 10_000),
      month("2026-05", 10_000),
      month("2026-06", 10_000),
      month("2026-07", 500),
    ];

    expect(recurringTrend(monthly)).toBeNull();
  });
});

describe("recurringSections", () => {
  it("keeps predicted patterns out of the confirmed run of rows", () => {
    const [fixed, behavioral] = recurringSections([
      item({ merchantKey: "small", typicalAmountMinor: 1000 }),
      item({
        confidence: "pattern",
        kind: "behavioral",
        merchantKey: "grocer",
        typicalAmountMinor: 4000,
      }),
      item({ merchantKey: "rent", typicalAmountMinor: 90_000 }),
    ]);

    expect(fixed.kind).toBe("fixed");
    expect(fixed.items.map((i) => i.merchantKey)).toEqual(["rent", "small"]);
    expect(fixed.monthlyMinor).toBe(92_328);
    expect(behavioral.items.map((i) => i.merchantKey)).toEqual(["grocer"]);
  });

  it("returns both sections even when one is empty", () => {
    const sections = recurringSections([]);

    expect(sections).toHaveLength(2);
    expect(sections[1].items).toHaveLength(0);
  });
});

describe("recurringInsights", () => {
  const asOf = new Date(2026, 8, 8);

  it("leads with what falls due this week", () => {
    const insights = recurringInsights(
      recurringData({
        items: [item({ nextExpected: new Date(2026, 8, 10).toISOString() })],
        plannedOutgoingMinor: 200_000,
      }),
      asOf
    );

    expect(insights[0]).toEqual({ count: 1, days: 7, kind: "due-soon" });
  });

  it("names the dearest commitment by its yearly cost", () => {
    const insights = recurringInsights(
      recurringData({
        items: [
          item({ merchantKey: "small", typicalAmountMinor: 1000 }),
          item({
            merchantKey: "insurer",
            merchantName: "Insurer",
            typicalAmountMinor: 20_000,
          }),
        ],
      }),
      asOf
    );

    expect(insights.at(-1)).toEqual({
      annualMinor: 243_500,
      kind: "top-annual",
      label: "Insurer",
    });
  });

  it("weighs commitments by their cost in the reporting currency", () => {
    const insights = recurringInsights(
      recurringData({
        items: [
          item({
            merchantKey: "insurer",
            merchantName: "Insurer",
            typicalAmountMinor: 20_000,
          }),
          item({
            currency: "JPY",
            merchantKey: "dojo",
            merchantName: "Dojo",
            reportingAmountMinor: 1000,
            typicalAmountMinor: 500_000,
          }),
        ],
      }),
      asOf
    );

    expect(insights.at(-1)).toEqual({
      annualMinor: 243_500,
      kind: "top-annual",
      label: "Insurer",
    });
  });

  it("says nothing it cannot measure", () => {
    expect(recurringInsights(recurringData(), asOf)).toEqual([]);
  });
});
