import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

import type { TimeRange } from "./period";
import type { Transaction } from "./transaction";

interface GroupHeader {
  type: "header";
  key: string;
  label: string;
  total: number;
  currency: string;
}

export type VirtualItem =
  | GroupHeader
  | { type: "tx"; key: string; tx: Transaction };

export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 56;

const ISO_DATE_LENGTH = 10;
const SUNDAY = 0;
const MONDAY = 1;
const DAYS_BEFORE_SUNDAY_OF_THE_SAME_WEEK = 6;
const DAYS_PER_WEEK = 7;
const TWO_DIGITS = 2;

const isoDay = (date: Date) => date.toISOString().slice(0, ISO_DATE_LENGTH);

const padded = (value: number) => String(value).padStart(TWO_DIGITS, "0");

const mondayOfWeek = (date: Date): Date => {
  const weekday = date.getDay();
  const monday = new Date(date);
  monday.setDate(
    date.getDate() -
      weekday +
      (weekday === SUNDAY ? -DAYS_BEFORE_SUNDAY_OF_THE_SAME_WEEK : MONDAY)
  );

  return monday;
};

const weekOfMonth = (monday: Date): number => {
  const firstWeekdayOfMonth = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    1
  ).getDay();

  return Math.ceil((monday.getDate() + firstWeekdayOfMonth) / DAYS_PER_WEEK);
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${padded(date.getMonth() + 1)}`;

const weekKey = (date: Date) => {
  const monday = mondayOfWeek(date);

  return `${monday.getFullYear()}-W${padded(weekOfMonth(monday))}-${padded(monday.getMonth() + 1)}-${padded(monday.getDate())}`;
};

export const groupKey = (dateStr: string, range: TimeRange): string => {
  const date = new Date(dateStr);

  if (range === "1Y") {
    return monthKey(date);
  }

  if (range === "3M") {
    return weekKey(date);
  }

  return isoDay(date);
};

const formatShortDate = (date: Date, locale: Locale) =>
  date.toLocaleDateString(locale, { day: "numeric", month: "short" });

const formatMonthKeyLabel = (key: string, locale: Locale): string => {
  const [year, month] = key.split("-");

  return new Date(Number(year), Number(month) - 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
};

const formatWeekKeyLabel = (key: string, locale: Locale): string => {
  const [year, , month, day] = key.split("-");
  const monday = new Date(Number(year), Number(month) - 1, Number(day));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + DAYS_BEFORE_SUNDAY_OF_THE_SAME_WEEK);

  return `${formatShortDate(monday, locale)} – ${formatShortDate(sunday, locale)}`;
};

const formatDayKeyLabel = (key: string, locale: Locale): string => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (key === isoDay(now)) {
    return m.budget_group_today();
  }

  if (key === isoDay(yesterday)) {
    return m.budget_group_yesterday();
  }

  return new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
};

export const formatGroupLabel = (
  key: string,
  range: TimeRange,
  locale: Locale
): string => {
  if (range === "1Y") {
    return formatMonthKeyLabel(key, locale);
  }

  if (range === "3M") {
    return formatWeekKeyLabel(key, locale);
  }

  return formatDayKeyLabel(key, locale);
};

export const buildVirtualItems = (
  transactions: Transaction[],
  range: TimeRange,
  locale: Locale
): VirtualItem[] => {
  if (transactions.length === 0) {
    return [];
  }

  const items: VirtualItem[] = [];
  let currentKey = "";
  let groupTotal = 0;
  let headerAwaitingItsTotal: GroupHeader | null = null;

  for (const tx of transactions) {
    const key = groupKey(tx.date, range);

    if (key !== currentKey) {
      if (headerAwaitingItsTotal) {
        headerAwaitingItsTotal.total = groupTotal;
      }

      currentKey = key;
      groupTotal = 0;
      headerAwaitingItsTotal = {
        currency: tx.currency,
        key: `header-${key}`,
        label: formatGroupLabel(key, range, locale),
        total: 0,
        type: "header",
      };

      items.push(headerAwaitingItsTotal);
    }

    groupTotal += tx.amount;
    items.push({ key: tx.id, tx, type: "tx" });
  }

  if (headerAwaitingItsTotal) {
    headerAwaitingItsTotal.total = groupTotal;
  }

  return items;
};
