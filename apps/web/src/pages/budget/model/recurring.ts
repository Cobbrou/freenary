import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import type { Locale } from "@/paraglide/runtime.js";

export type RecurrenceConfidence = (typeof RECURRENCE_CONFIDENCES)[number];

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export interface RecurringItem {
  amountSpread: number;
  category: SpendingCategory;
  confidence: RecurrenceConfidence;
  currency: string;
  frequency: RecurrenceFrequency;
  intervalDays: number;
  kind: RecurrenceKind;
  lastSeen: string;
  merchantKey: string;
  merchantName: string | null;
  nextExpected: string;
  occurrences: number;
  typicalAmountMinor: number;
}

export interface RecurringMonth {
  behavioralMinor: number;
  discretionaryMinor: number;
  fixedMinor: number;
  month: string;
}

export interface RecurringData {
  asOf: string;
  availableBalanceMinor: number | null;
  currency: string;
  items: RecurringItem[];
  monthly: RecurringMonth[];
  monthlyIncomeMinor: number | null;
  plannedOutgoingMinor: number | null;
}

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
}

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
] as const;

export const RECURRENCE_FREQUENCIES = [
  "annual",
  "irregular",
  "monthly",
  "quarterly",
  "weekly",
] as const;

export const RECURRENCE_KINDS = ["behavioral", "fixed"] as const;

export const UPCOMING_HORIZON_DAYS = 30;

export const DUE_SOON_DAYS = 7;

export const FORECAST_HORIZON_DAYS = 30;

export const TREND_WINDOW_MONTHS = 3;

const TREND_FLAT_RATIO = 0.02;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MEAN_DAYS_PER_YEAR = 365.25;
const MEAN_DAYS_PER_MONTH = MEAN_DAYS_PER_YEAR / 12;

const MAX_PROJECTED_OCCURRENCES = 64;

const NO_USABLE_CADENCE = 0;
const DEFAULT_PURCHASE_FREQUENCY_LIMIT = 8;

const usableCadenceDays = (item: RecurringItem): number =>
  item.intervalDays >= 1 ? item.intervalDays : NO_USABLE_CADENCE;

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const dayDelta = (from: Date, to: Date): number =>
  Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY
  );

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

export const monthlyEquivalentMinor = (item: RecurringItem): number => {
  const days = usableCadenceDays(item);

  return days === NO_USABLE_CADENCE
    ? 0
    : Math.round((item.typicalAmountMinor * MEAN_DAYS_PER_MONTH) / days);
};

export const annualCostMinor = (item: RecurringItem): number => {
  const days = usableCadenceDays(item);

  return days === NO_USABLE_CADENCE
    ? 0
    : Math.round((item.typicalAmountMinor * MEAN_DAYS_PER_YEAR) / days);
};

export const merchantLabel = (item: RecurringItem): string =>
  item.merchantName ?? item.merchantKey;

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
  horizonDays: number = UPCOMING_HORIZON_DAYS
): UpcomingPayment[] => {
  const payments: UpcomingPayment[] = [];

  for (const item of items) {
    const cadenceDays = usableCadenceDays(item);
    const expected = new Date(item.nextExpected);

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
      });

      when = addDays(when, cadenceDays);
      daysAway = dayDelta(asOf, when);
      emitted += 1;
    }
  }

  return payments.toSorted((a, b) => a.date.getTime() - b.date.getTime());
};

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
      monthlyMinor += monthlyEquivalentMinor(item);
      annualMinor += annualCostMinor(item);
    } else {
      behavioralCount += 1;
    }
  }

  const upcoming = upcomingPayments(recurring.items, asOf);
  const { denominatorKind, denominatorMinor } = spendDenominator(recurring);

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
    upcomingCount: upcoming.length,
    upcomingMinor: upcoming.reduce(
      (total, payment) => total + payment.amountMinor,
      0
    ),
  };
};

export const recurringByCategory = (
  items: RecurringItem[]
): RecurringCategoryRow[] => {
  const rows = new Map<SpendingCategory, RecurringCategoryRow>();

  for (const item of items) {
    const row = rows.get(item.category);
    const monthlyMinor = monthlyEquivalentMinor(item);

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

const frequencyRow = (item: RecurringItem): FrequencyRow => {
  const days = usableCadenceDays(item);

  return {
    annualMinor: annualCostMinor(item),
    category: item.category,
    id: item.merchantKey,
    kind: item.kind,
    label: merchantLabel(item),
    occurrences: item.occurrences,
    perYear: days === NO_USABLE_CADENCE ? 0 : MEAN_DAYS_PER_YEAR / days,
  };
};

export const purchaseFrequency = (
  items: RecurringItem[],
  limit = DEFAULT_PURCHASE_FREQUENCY_LIMIT
): FrequencyRow[] =>
  items
    .map(frequencyRow)
    .toSorted(
      (a, b) => b.occurrences - a.occurrences || b.annualMinor - a.annualMinor
    )
    .slice(0, limit);

export const frequencyCostPoints = (items: RecurringItem[]): FrequencyRow[] =>
  items.map(frequencyRow);

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
    const day = dueByDay.get(payment.daysAway);

    if (day) {
      day.labels.push(payment.label);
      day.minor += payment.amountMinor;
    } else {
      dueByDay.set(payment.daysAway, {
        labels: [payment.label],
        minor: payment.amountMinor,
      });
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
        (a, b) => monthlyEquivalentMinor(b) - monthlyEquivalentMinor(a)
      );

    let monthlyMinor = 0;

    for (const item of own) {
      monthlyMinor += monthlyEquivalentMinor(item);
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

const dearestCommitment = (items: RecurringItem[]): RecurringItem | null => {
  let dearest: RecurringItem | null = null;

  for (const item of items) {
    if (
      item.kind === "fixed" &&
      (dearest === null || annualCostMinor(item) > annualCostMinor(dearest))
    ) {
      dearest = item;
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
      annualMinor: annualCostMinor(dearest),
      kind: "top-annual",
      label: merchantLabel(dearest),
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
