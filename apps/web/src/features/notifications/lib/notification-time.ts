import { dayDelta, recentDateLabel } from "@/shared/lib/calendar-day";

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

export const notificationTimeLabel = (
  createdAt: Date,
  now: Date,
  locale: string
): string =>
  dayDelta(now, createdAt) === 0
    ? createdAt.toLocaleTimeString(locale, TIME_FORMAT)
    : recentDateLabel(createdAt, now, locale);
