const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const localDayOfBankDate = (dateStr: string): Date => {
  const bankDate = new Date(dateStr);

  return new Date(
    bankDate.getUTCFullYear(),
    bankDate.getUTCMonth(),
    bankDate.getUTCDate()
  );
};

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const dayDelta = (from: Date, to: Date): number =>
  Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY
  );

export const addDays = (date: Date, days: number): Date => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);

  return shifted;
};
