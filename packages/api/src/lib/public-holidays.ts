import Holidays from "date-holidays";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NOON_UTC_HOURS = 12;

const SATURDAY = 6;
const SUNDAY = 0;

const calendars = new Map<string, Holidays>();

let supportedCountries: Set<string> | null = null;

const isSupportedCountry = (country: string): boolean => {
  supportedCountries ??= new Set(Object.keys(new Holidays().getCountries()));

  return supportedCountries.has(country);
};

const calendarOf = (country: string): Holidays | null => {
  const cached = calendars.get(country);

  if (cached) {
    return cached;
  }

  if (!isSupportedCountry(country)) {
    return null;
  }

  const calendar = new Holidays(country);
  calendars.set(country, calendar);

  return calendar;
};

export const holidayCountries = (language: string): Record<string, string> =>
  new Holidays().getCountries(language);

export const isPublicHoliday = (day: Date, country: string | null): boolean => {
  const calendar = country === null ? null : calendarOf(country);

  if (calendar === null) {
    return false;
  }

  const noon = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      NOON_UTC_HOURS
    )
  );

  const holidays = calendar.isHoliday(noon);

  return (
    holidays !== false && holidays.some((holiday) => holiday.type === "public")
  );
};

export const isWorkingDay = (day: Date, country: string | null): boolean => {
  const weekday = day.getUTCDay();

  return (
    weekday !== SATURDAY && weekday !== SUNDAY && !isPublicHoliday(day, country)
  );
};

export const lastWorkingDayOfMonth = (
  year: number,
  month: number,
  country: string | null
): Date => {
  let day = new Date(Date.UTC(year, month + 1, 0));

  while (!isWorkingDay(day, country)) {
    day = new Date(day.getTime() - MS_PER_DAY);
  }

  return day;
};
