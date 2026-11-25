import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

import {
  addDays,
  dayDelta,
  localDayOfBankDate,
} from "@/shared/lib/calendar-day";
import { readableName } from "@/shared/lib/text";

export type RecurringData =
  InferRouterOutputs<AppRouter>["budget"]["getRecurring"];

export type RecurringItem = RecurringData["items"][number];

type RecurrenceConfidence = RecurringItem["confidence"];

type RecurrenceKind = RecurringItem["kind"];

export interface UpcomingPayment {
  amountMinor: number;
  category: SpendingCategory;
  confidence: RecurrenceConfidence;
  currency: string;
  date: Date;
  daysAway: number;
  id: string;
  kind: RecurrenceKind;
  label: string;
  reportingAmountMinor: number | null;
}

export interface ReportingTotal {
  includedCount: number;
  totalMinor: number;
  unconvertedCount: number;
}

const MAX_PROJECTED_OCCURRENCES = 64;

export const NO_USABLE_CADENCE = 0;

export const usableCadenceDays = (item: RecurringItem): number =>
  item.intervalDays >= 1 ? item.intervalDays : NO_USABLE_CADENCE;

export const merchantLabel = (item: RecurringItem): string =>
  readableName(item.merchantName ?? item.merchantKey);

const rollForwardToNextSlot = (
  expected: Date,
  cadenceDays: number,
  asOf: Date
): Date => {
  let when = expected;
  let steps = 0;

  while (dayDelta(asOf, when) < 0 && steps < MAX_PROJECTED_OCCURRENCES) {
    when = addDays(when, cadenceDays);
    steps += 1;
  }

  return when;
};

export const upcomingPayments = (
  items: RecurringItem[],
  asOf: Date,
  horizonDays: number
): UpcomingPayment[] => {
  const payments: UpcomingPayment[] = [];

  for (const item of items) {
    const cadenceDays = usableCadenceDays(item);
    const expected = localDayOfBankDate(item.nextExpected);

    if (cadenceDays === NO_USABLE_CADENCE || Number.isNaN(expected.getTime())) {
      continue;
    }

    let when = rollForwardToNextSlot(expected, cadenceDays, asOf);
    let daysAway = dayDelta(asOf, when);

    if (daysAway < 0) {
      continue;
    }

    let emitted = 0;

    while (daysAway <= horizonDays && emitted < MAX_PROJECTED_OCCURRENCES) {
      payments.push({
        amountMinor: item.typicalAmountMinor,
        category: item.category,
        confidence: item.confidence,
        currency: item.currency,
        date: when,
        daysAway,
        id: `${item.merchantKey}@${daysAway}`,
        kind: item.kind,
        label: merchantLabel(item),
        reportingAmountMinor: item.reportingAmountMinor,
      });

      when = addDays(when, cadenceDays);
      daysAway = dayDelta(asOf, when);
      emitted += 1;
    }
  }

  return payments.toSorted((a, b) => a.date.getTime() - b.date.getTime());
};

export const reportingTotalOf = (
  amounts: readonly { reportingAmountMinor: number | null }[]
): ReportingTotal => {
  const total: ReportingTotal = {
    includedCount: 0,
    totalMinor: 0,
    unconvertedCount: 0,
  };

  for (const { reportingAmountMinor } of amounts) {
    if (reportingAmountMinor === null) {
      total.unconvertedCount += 1;
    } else {
      total.includedCount += 1;
      total.totalMinor += reportingAmountMinor;
    }
  }

  return total;
};
