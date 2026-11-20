import { m } from "@/paraglide/messages.js";

const MORNING_FROM_HOUR = 5;
const AFTERNOON_FROM_HOUR = 12;
const EVENING_FROM_HOUR = 18;

export const greetingFor = (hour: number, name: string): string => {
  if (hour >= MORNING_FROM_HOUR && hour < AFTERNOON_FROM_HOUR) {
    return m.home_greeting_morning({ name });
  }

  if (hour >= AFTERNOON_FROM_HOUR && hour < EVENING_FROM_HOUR) {
    return m.home_greeting_afternoon({ name });
  }

  return m.home_greeting_evening({ name });
};
