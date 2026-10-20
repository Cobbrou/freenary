import prisma from "@freenary/db";
import { Array as Arr, Option } from "effect";

import type { SpendingCategory } from "../lib/taxonomy";
import { resolveCategorySlug } from "../lib/taxonomy";
import type { Iso4217Currency, OutgoingNegativeMinorUnits } from "./types";

export type RecurrenceKind = "behavioral" | "fixed";

export type RecurrenceConfidence = "confirmed" | "likely" | "pattern";

export type RecurrenceFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "irregular";

export interface RecurringExpense {
  merchantKey: string;
  merchantName: string | null;
  category: SpendingCategory;
  intervalDays: number;
  frequency: RecurrenceFrequency;
  typicalAmountMinor: number;
  currency: Iso4217Currency;
  occurrences: number;
  lastSeen: Date;
  nextExpected: Date;
  amountSpread: number;
  intervalSpread: number;
  kind: RecurrenceKind;
  confidence: RecurrenceConfidence;
}

interface FrequencyBand {
  label: RecurrenceFrequency;
  maxDays: number;
  minDays: number;
  minOccurrences: number;
}

export interface RecurrenceSignals {
  amountSpread: number;
  frequency: RecurrenceFrequency;
  intervalSpread: number;
  occurrences: number;
}

export interface RecurrenceClass {
  confidence: RecurrenceConfidence;
  kind: RecurrenceKind;
}

export interface RecurrenceTransaction {
  amount: OutgoingNegativeMinorUnits;
  category: string | null;
  counterpartyName: string | null;
  currency: Iso4217Currency;
  date: Date;
  merchantKey: string | null;
  resolvedCategory: string | null;
}

export interface RecurrenceWindow {
  from: Date;
  to: Date;
}

export interface RecurringMonthTotals {
  behavioralMinor: number;
  discretionaryMinor: number;
  fixedMinor: number;
  month: string;
}

export interface RecurringDetection {
  expenses: RecurringExpense[];
  months: RecurringMonthTotals[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const OBSERVATION_WINDOW_MS = 365 * MS_PER_DAY;

const FREQUENCY_BANDS: readonly FrequencyBand[] = [
  { label: "weekly", maxDays: 9, minDays: 5, minOccurrences: 4 },
  { label: "monthly", maxDays: 35, minDays: 25, minOccurrences: 3 },
  { label: "quarterly", maxDays: 100, minDays: 80, minOccurrences: 2 },
  { label: "annual", maxDays: 395, minDays: 340, minOccurrences: 2 },
];

const IRREGULAR_MIN_OCCURRENCES = 4;
const IRREGULAR_MIN_DAYS = 10;
const IRREGULAR_MAX_DAYS = 400;

export const STABLE_AMOUNT_SPREAD = 0.05;

export const VARIABLE_AMOUNT_SPREAD = 0.25;

export const REGULAR_INTERVAL_SPREAD = 0.2;

const CONFIRMED_MIN_OCCURRENCES = 3;

const MIN_OCCURRENCES_FOR_AN_INTERVAL = 2;

const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }

  return sorted[mid] ?? 0;
};

const mode = <T>(values: Arr.NonEmptyReadonlyArray<T>): T => {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let [best] = values;
  let bestCount = 0;

  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  return best;
};

const classifyFrequency = (
  medianInterval: number,
  occurrences: number
): RecurrenceFrequency | null => {
  for (const { label, maxDays, minDays, minOccurrences } of FREQUENCY_BANDS) {
    if (medianInterval >= minDays && medianInterval <= maxDays) {
      return occurrences < minOccurrences ? null : label;
    }
  }

  const readsAsIrregular =
    occurrences >= IRREGULAR_MIN_OCCURRENCES &&
    medianInterval >= IRREGULAR_MIN_DAYS &&
    medianInterval <= IRREGULAR_MAX_DAYS;

  return readsAsIrregular ? "irregular" : null;
};

const relativeSpread = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const centre = median(sorted);

  if (centre === 0) {
    return 0;
  }

  const deviations = sorted
    .map((value) => Math.abs(value - centre))
    .toSorted((a, b) => a - b);

  return median(deviations) / centre;
};

export const classifyRecurrence = ({
  amountSpread,
  frequency,
  intervalSpread,
  occurrences,
}: RecurrenceSignals): RecurrenceClass => {
  const scheduled =
    frequency !== "irregular" &&
    intervalSpread <= REGULAR_INTERVAL_SPREAD &&
    amountSpread <= VARIABLE_AMOUNT_SPREAD;

  if (!scheduled) {
    return { confidence: "pattern", kind: "behavioral" };
  }

  const confirmed =
    amountSpread <= STABLE_AMOUNT_SPREAD &&
    occurrences >= CONFIRMED_MIN_OCCURRENCES;

  return { confidence: confirmed ? "confirmed" : "likely", kind: "fixed" };
};

const inWindowByMerchant = (
  transactions: RecurrenceTransaction[],
  window: RecurrenceWindow
): Map<string, RecurrenceTransaction[]> => {
  const groups = new Map<string, RecurrenceTransaction[]>();

  for (const tx of transactions) {
    if (
      tx.merchantKey === null ||
      tx.date < window.from ||
      tx.date > window.to
    ) {
      continue;
    }

    const existing = groups.get(tx.merchantKey);

    if (existing) {
      existing.push(tx);
    } else {
      groups.set(tx.merchantKey, [tx]);
    }
  }

  return groups;
};

const daysBetweenConsecutive = (
  txs: readonly RecurrenceTransaction[]
): number[] => {
  const intervals: number[] = [];

  let previous: RecurrenceTransaction | undefined;

  for (const current of txs) {
    if (previous) {
      const gapMs = current.date.getTime() - previous.date.getTime();
      intervals.push(Math.round(gapMs / MS_PER_DAY));
    }

    previous = current;
  }

  return intervals;
};

const recurringFrom = (
  merchantKey: string,
  txs: Arr.NonEmptyArray<RecurrenceTransaction>
): RecurringExpense | null => {
  txs.sort((a, b) => a.date.getTime() - b.date.getTime());

  const intervals = daysBetweenConsecutive(txs).toSorted((a, b) => a - b);
  const medianInterval = median(intervals);
  const frequency = classifyFrequency(medianInterval, txs.length);

  if (frequency === null) {
    return null;
  }

  const amounts = txs
    .map((tx) => Math.abs(tx.amount))
    .toSorted((a, b) => a - b);

  const amountSpread = relativeSpread(amounts);
  const intervalSpread = relativeSpread(intervals);
  const { confidence, kind } = classifyRecurrence({
    amountSpread,
    frequency,
    intervalSpread,
    occurrences: txs.length,
  });

  const lastTx = Arr.lastNonEmpty(txs);
  const storedCategories = txs.flatMap((tx) => {
    const category = tx.category ?? tx.resolvedCategory;

    return category === null ? [] : [category];
  });

  const modalCategory = Arr.isArrayNonEmpty(storedCategories)
    ? mode(storedCategories)
    : "uncategorised";

  return {
    amountSpread,
    category: resolveCategorySlug(modalCategory) ?? "uncategorised",
    confidence,
    currency: lastTx.currency,
    frequency,
    intervalDays: Math.round(medianInterval),
    intervalSpread,
    kind,
    lastSeen: lastTx.date,
    merchantKey,
    merchantName: lastTx.counterpartyName,
    nextExpected: new Date(lastTx.date.getTime() + medianInterval * MS_PER_DAY),
    occurrences: txs.length,
    typicalAmountMinor: Math.round(median(amounts)),
  };
};

export const recurringInWindow = (
  transactions: RecurrenceTransaction[],
  window: RecurrenceWindow
): RecurringExpense[] => {
  const detected: RecurringExpense[] = [];

  for (const [merchantKey, txs] of inWindowByMerchant(transactions, window)) {
    if (
      txs.length < MIN_OCCURRENCES_FOR_AN_INTERVAL ||
      !Arr.isArrayNonEmpty(txs)
    ) {
      continue;
    }

    const expense = recurringFrom(merchantKey, txs);

    if (expense) {
      detected.push(expense);
    }
  }

  detected.sort((a, b) => b.typicalAmountMinor - a.typicalAmountMinor);

  return detected;
};

export const cadenceWindow = (from: Date, to: Date): RecurrenceWindow => ({
  from: new Date(from.getTime() - OBSERVATION_WINDOW_MS),
  to: new Date(to.getTime() + OBSERVATION_WINDOW_MS),
});

export const trailingYear = (to: Date = new Date()): RecurrenceWindow => ({
  from: new Date(to.getTime() - OBSERVATION_WINDOW_MS),
  to,
});

export const recurringMonthsInWindow = (
  transactions: RecurrenceTransaction[],
  window: RecurrenceWindow,
  expenses: RecurringExpense[]
): RecurringMonthTotals[] => {
  const kinds = new Map(expenses.map((e) => [e.merchantKey, e.kind]));
  const months = new Map<string, RecurringMonthTotals>();

  for (const tx of transactions) {
    if (tx.date < window.from || tx.date > window.to) {
      continue;
    }

    const month = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    let totals = months.get(month);

    if (!totals) {
      totals = {
        behavioralMinor: 0,
        discretionaryMinor: 0,
        fixedMinor: 0,
        month,
      };

      months.set(month, totals);
    }

    const amount = Math.abs(tx.amount);
    const kind =
      tx.merchantKey === null ? undefined : kinds.get(tx.merchantKey);

    if (kind === "fixed") {
      totals.fixedMinor += amount;
    } else if (kind === "behavioral") {
      totals.behavioralMinor += amount;
    } else {
      totals.discretionaryMinor += amount;
    }
  }

  return [...months.values()].toSorted((a, b) =>
    a.month.localeCompare(b.month)
  );
};

const outgoingInWindow = async (
  userId: string,
  window: RecurrenceWindow
): Promise<RecurrenceTransaction[]> => {
  const accounts = await prisma.bankAccount.findMany({
    select: { id: true },
    where: {
      connection: { userId },
    },
  });

  if (accounts.length === 0) {
    return [];
  }

  return prisma.transaction.findMany({
    orderBy: { date: "asc" },
    select: {
      amount: true,
      category: true,
      counterpartyName: true,
      currency: true,
      date: true,
      merchantKey: true,
      resolvedCategory: true,
    },
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      amount: { lt: 0 },
      date: { gte: window.from, lte: window.to },
      isInternalTransfer: false,
    },
  });
};

const detectionOrNone = Option.liftThrowable(
  (
    transactions: RecurrenceTransaction[],
    window: RecurrenceWindow
  ): RecurringDetection => {
    const expenses = recurringInWindow(transactions, window);

    return {
      expenses,
      months: recurringMonthsInWindow(transactions, window, expenses),
    };
  }
);

export const detectRecurring = async (
  userId: string,
  window: RecurrenceWindow
): Promise<RecurringDetection> => {
  const detected = await outgoingInWindow(userId, window).then(
    (transactions) => detectionOrNone(transactions, window),
    Option.none
  );

  return Option.getOrElse(detected, () => ({ expenses: [], months: [] }));
};

export const detectRecurringExpenses = async (
  userId: string,
  window: RecurrenceWindow
): Promise<RecurringExpense[]> => {
  const detected = await detectRecurring(userId, window);

  return detected.expenses;
};
