import { dayDelta } from "./calendar-day";

const NEAREST_NAMED_DAY = 1;

const SAME_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const OTHER_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  ...SAME_YEAR_FORMAT,
  year: "numeric",
};

export const recentDateLabel = (
  date: Date,
  today: Date,
  locale: string
): string => {
  const delta = dayDelta(today, date);

  if (Math.abs(delta) <= NEAREST_NAMED_DAY) {
    const relative = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(delta, "day");

    return `${relative.charAt(0).toLocaleUpperCase(locale)}${relative.slice(1)}`;
  }

  return date.toLocaleDateString(
    locale,
    date.getFullYear() === today.getFullYear()
      ? SAME_YEAR_FORMAT
      : OTHER_YEAR_FORMAT
  );
};
