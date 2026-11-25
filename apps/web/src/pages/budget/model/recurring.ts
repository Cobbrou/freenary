import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import {
  merchantLabel,
  NO_USABLE_CADENCE,
  reportingTotalOf,
  upcomingPayments,
  usableCadenceDays,
} from "@/entities/recurring";
import type { RecurringData, RecurringItem } from "@/entities/recurring";
import type { Locale } from "@/paraglide/runtime.js";
import { addDays, startOfDay } from "@/shared/lib/calendar-day";

export type RecurringMonth = RecurringData["monthly"][number];

export type RecurrenceConfidence = RecurringItem["confidence"];

export type RecurrenceFrequency = RecurringItem["frequency"];

export type RecurrenceKind = RecurringItem["kind"];

type SpendDenominatorKind = "income" | "plan";

interface SpendDenominator {
  denominatorKind: SpendDenominatorKind | null;
  denominatorMinor: number | null;
}

export interface RecurringSummary extends SpendDenominator {
  activeCount: number;
  annualMinor: number;
  behavioralCount: number;
  dueSoonCount: number;
  monthlyMinor: number;
  remainingMinor: number | null;
  share: number | null;
  unconvertedItemCount: number;
  upcomingCount: number;
  upcomingMinor: number;
}

export interface RecurringCategoryRow {
  category: SpendingCategory;
  count: number;
  monthlyMinor: number;
}

export interface FrequencyRow {
  annualMinor: number;
  category: SpendingCategory;
  id: string;
  kind: RecurrenceKind;
  label: string;
  occurrences: number;
  perYear: number;
}

export interface ForecastPoint {
  balanceMinor: number;
  date: Date;
  dueMinor: number;
  labels: string[];
}

export interface SpendSplit {
  behavioralMinor: number;
  discretionaryMinor: number;
  fixedMinor: number;
}

export interface RecurringSection {
  items: RecurringItem[];
  kind: RecurrenceKind;
  monthlyMinor: number;
}

export interface RecurringTrend {
  direction: "down" | "flat" | "up";
  ratio: number;
}

export type RecurringInsight =
  | { annualMinor: number; kind: "top-annual"; label: string }
  | { count: number; days: number; kind: "due-soon" }
  | { denominator: SpendDenominatorKind; kind: "share"; share: number }
  | { kind: "trend"; trend: RecurringTrend };

export const RECURRENCE_CONFIDENCES = [
  "confirmed",
  "likely",
  "pattern",
] as const satisfies readonly RecurrenceConfidence[];

export const RECURRENCE_FREQUENCIES = [
  "annual",
  "irregular",
  "monthly",
  "quarterly",
  "weekly",
] as const satisfies readonly RecurrenceFrequency[];

export const RECURRENCE_KINDS = [
  "behavioral",
  "fixed",
] as const satisfies readonly RecurrenceKind[];

export const UPCOMING_HORIZON_DAYS = 30;

export const DUE_SOON_DAYS = 7;

export const FORECAST_HORIZON_DAYS = 30;

export const TREND_WINDOW_MONTHS = 3;

const TREND_FLAT_RATIO = 0.02;

const MEAN_DAYS_PER_YEAR = 365.25;
const MEAN_DAYS_PER_MONTH = MEAN_DAYS_PER_YEAR / 12;

const DEFAULT_PURCHASE_FREQUENCY_LIMIT = 8;

const perPeriodMinor = (
  item: RecurringItem,
  amountMinor: number,
  periodDays: number
): number => {
  const days = usableCadenceDays(item);

  return days === NO_USABLE_CADENCE
    ? 0
    : Math.round((amountMinor * periodDays) / days);
};

export const monthlyEquivalentMinor = (item: RecurringItem): number =>
  perPeriodMinor(item, item.typicalAmountMinor, MEAN_DAYS_PER_MONTH);

export const annualCostMinor = (item: RecurringItem): number =>
  perPeriodMinor(item, item.typicalAmountMinor, MEAN_DAYS_PER_YEAR);

export const reportingMonthlyMinor = (item: RecurringItem): number | null =>
  item.reportingAmountMinor === null
    ? null
    : perPeriodMinor(item, item.reportingAmountMinor, MEAN_DAYS_PER_MONTH);

export const reportingAnnualMinor = (item: RecurringItem): number | null =>
  item.reportingAmountMinor === null
    ? null
    : perPeriodMinor(item, item.reportingAmountMinor, MEAN_DAYS_PER_YEAR);

export const comparableMonthlyMinor = (item: RecurringItem): number =>
  reportingMonthlyMinor(item) ?? monthlyEquivalentMinor(item);

export const unconvertedItemCount = (items: readonly RecurringItem[]): number =>
  items.filter((item) => item.reportingAmountMinor === null).length;

const spendDenominator = (recurring: RecurringData): SpendDenominator => {
  const declaredPlan = recurring.plannedOutgoingMinor;
  const observedIncome = recurring.monthlyIncomeMinor;

  if (declaredPlan !== null && declaredPlan > 0) {
    return { denominatorKind: "plan", denominatorMinor: declaredPlan };
  }

  if (observedIncome !== null && observedIncome > 0) {
    return { denominatorKind: "income", denominatorMinor: observedIncome };
  }

  return { denominatorKind: null, denominatorMinor: null };
};

export const recurringSummary = (
  recurring: RecurringData,
  asOf: Date
): RecurringSummary => {
  let monthlyMinor = 0;
  let annualMinor = 0;
  let activeCount = 0;
  let behavioralCount = 0;

  for (const item of recurring.items) {
    if (item.kind === "fixed") {
      activeCount += 1;
      monthlyMinor += reportingMonthlyMinor(item) ?? 0;
      annualMinor += reportingAnnualMinor(item) ?? 0;
    } else {
      behavioralCount += 1;
    }
  }

  const upcoming = upcomingPayments(
    recurring.items,
    asOf,
    UPCOMING_HORIZON_DAYS
  );

  const { denominatorKind, denominatorMinor } = spendDenominator(recurring);
  const upcomingTotal = reportingTotalOf(upcoming);

  return {
    activeCount,
    annualMinor,
    behavioralCount,
    denominatorKind,
    denominatorMinor,
    dueSoonCount: upcoming.filter((p) => p.daysAway <= DUE_SOON_DAYS).length,
    monthlyMinor,
    remainingMinor:
      denominatorMinor === null ? null : denominatorMinor - monthlyMinor,
    share: denominatorMinor === null ? null : monthlyMinor / denominatorMinor,
    unconvertedItemCount: unconvertedItemCount(recurring.items),
    upcomingCount: upcomingTotal.includedCount,
    upcomingMinor: upcomingTotal.totalMinor,
  };
};

export const recurringByCategory = (
  items: RecurringItem[]
): RecurringCategoryRow[] => {
  const rows = new Map<SpendingCategory, RecurringCategoryRow>();

  for (const item of items) {
    const row = rows.get(item.category);
    const monthlyMinor = reportingMonthlyMinor(item);

    if (monthlyMinor === null) {
      continue;
    }

    if (row) {
      row.count += 1;
      row.monthlyMinor += monthlyMinor;
    } else {
      rows.set(item.category, {
        category: item.category,
        count: 1,
        monthlyMinor,
      });
    }
  }

  return [...rows.values()].toSorted((a, b) => b.monthlyMinor - a.monthlyMinor);
};

const frequencyRow = (
  item: RecurringItem,
  annualMinor: number
): FrequencyRow => {
  const days = usableCadenceDays(item);

  return {
    annualMinor,
    category: item.category,
    id: item.merchantKey,
    kind: item.kind,
    label: merchantLabel(item),
    occurrences: item.occurrences,
    perYear: days === NO_USABLE_CADENCE ? 0 : MEAN_DAYS_PER_YEAR / days,
  };
};

const frequencyRows = (items: RecurringItem[]): FrequencyRow[] =>
  items.flatMap((item) => {
    const annualMinor = reportingAnnualMinor(item);

    return annualMinor === null ? [] : [frequencyRow(item, annualMinor)];
  });

export const purchaseFrequency = (
  items: RecurringItem[],
  limit = DEFAULT_PURCHASE_FREQUENCY_LIMIT
): FrequencyRow[] =>
  frequencyRows(items)
    .toSorted(
      (a, b) => b.occurrences - a.occurrences || b.annualMinor - a.annualMinor
    )
    .slice(0, limit);

export const frequencyCostPoints = (items: RecurringItem[]): FrequencyRow[] =>
  frequencyRows(items);

export const forecastSeries = (
  recurring: RecurringData,
  asOf: Date,
  horizonDays: number = FORECAST_HORIZON_DAYS
): ForecastPoint[] => {
  if (recurring.availableBalanceMinor === null) {
    return [];
  }

  const dueByDay = new Map<number, { labels: string[]; minor: number }>();

  for (const payment of upcomingPayments(recurring.items, asOf, horizonDays)) {
    const minor = payment.reportingAmountMinor;

    if (minor === null) {
      continue;
    }

    const day = dueByDay.get(payment.daysAway);

    if (day) {
      day.labels.push(payment.label);
      day.minor += minor;
    } else {
      dueByDay.set(payment.daysAway, { labels: [payment.label], minor });
    }
  }

  const points: ForecastPoint[] = [];
  const start = startOfDay(asOf);
  let balanceMinor = recurring.availableBalanceMinor;

  for (let daysAway = 0; daysAway <= horizonDays; daysAway += 1) {
    const day = dueByDay.get(daysAway);
    const dueMinor = day?.minor ?? 0;
    balanceMinor -= dueMinor;
    points.push({
      balanceMinor,
      date: addDays(start, daysAway),
      dueMinor,
      labels: day?.labels ?? [],
    });
  }

  return points;
};

export const spendSplit = (monthly: RecurringMonth[]): SpendSplit => {
  const split: SpendSplit = {
    behavioralMinor: 0,
    discretionaryMinor: 0,
    fixedMinor: 0,
  };

  for (const month of monthly) {
    split.behavioralMinor += month.behavioralMinor;
    split.discretionaryMinor += month.discretionaryMinor;
    split.fixedMinor += month.fixedMinor;
  }

  return split;
};

const mean = (values: number[]): number => {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total / values.length;
};

export const recurringSections = (
  items: RecurringItem[]
): [RecurringSection, RecurringSection] => {
  const section = (kind: RecurrenceKind): RecurringSection => {
    const own = items
      .filter((item) => item.kind === kind)
      .toSorted(
        (a, b) => comparableMonthlyMinor(b) - comparableMonthlyMinor(a)
      );

    let monthlyMinor = 0;

    for (const item of own) {
      monthlyMinor += reportingMonthlyMinor(item) ?? 0;
    }

    return { items: own, kind, monthlyMinor };
  };

  return [section("fixed"), section("behavioral")];
};

const isZeroFilledMonth = (month: RecurringMonth) =>
  month.behavioralMinor + month.discretionaryMinor + month.fixedMinor === 0;

export const recurringTrend = (
  monthly: RecurringMonth[],
  window: number = TREND_WINDOW_MONTHS
): RecurringTrend | null => {
  const wholeMonths = monthly.slice(0, -1);
  const comparedMonths = wholeMonths.slice(-window * 2);

  if (
    comparedMonths.length < window * 2 ||
    comparedMonths.some(isZeroFilledMonth)
  ) {
    return null;
  }

  const recurringMinor = comparedMonths.map(
    (month) => month.behavioralMinor + month.fixedMinor
  );

  const recent = mean(recurringMinor.slice(-window));
  const prior = mean(recurringMinor.slice(0, window));

  if (prior === 0) {
    return null;
  }

  const ratio = (recent - prior) / prior;

  if (Math.abs(ratio) < TREND_FLAT_RATIO) {
    return { direction: "flat", ratio: 0 };
  }

  return { direction: ratio > 0 ? "up" : "down", ratio };
};

const dearestCommitment = (
  items: RecurringItem[]
): { annualMinor: number; item: RecurringItem } | null => {
  let dearest: { annualMinor: number; item: RecurringItem } | null = null;

  for (const item of items) {
    const annualMinor = reportingAnnualMinor(item);

    if (
      item.kind === "fixed" &&
      annualMinor !== null &&
      (dearest === null || annualMinor > dearest.annualMinor)
    ) {
      dearest = { annualMinor, item };
    }
  }

  return dearest;
};

export const recurringInsights = (
  recurring: RecurringData,
  asOf: Date
): RecurringInsight[] => {
  const mostActionableFirst: RecurringInsight[] = [];
  const summary = recurringSummary(recurring, asOf);

  if (summary.dueSoonCount > 0) {
    mostActionableFirst.push({
      count: summary.dueSoonCount,
      days: DUE_SOON_DAYS,
      kind: "due-soon",
    });
  }

  const trend = recurringTrend(recurring.monthly);

  if (trend) {
    mostActionableFirst.push({ kind: "trend", trend });
  }

  if (summary.denominatorKind !== null && summary.share !== null) {
    mostActionableFirst.push({
      denominator: summary.denominatorKind,
      kind: "share",
      share: summary.share,
    });
  }

  const dearest = dearestCommitment(recurring.items);

  if (dearest) {
    mostActionableFirst.push({
      annualMinor: dearest.annualMinor,
      kind: "top-annual",
      label: merchantLabel(dearest.item),
    });
  }

  return mostActionableFirst;
};

export const monthKeyLabel = (month: string, locale: Locale): string => {
  const [year, monthNumber] = month.split("-").map(Number);

  if (Number.isNaN(year) || Number.isNaN(monthNumber)) {
    return month;
  }

  return new Date(year, monthNumber - 1, 1).toLocaleDateString(locale, {
    month: "short",
  });
};
