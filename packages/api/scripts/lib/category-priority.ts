import type { SpendingCategory } from "../../src/lib/taxonomy";

const PRIORITY_LADDER = [
  "no-standalone-intent",
  "bolted-on-forecourt",
  "bolted-on-aisle",
  "leisure",
  "financial",
  "education",
  "travel",
  "eating-out",
  "utilities",
  "health",
  "everyday-essentials",
] as const;

type PriorityRung = (typeof PRIORITY_LADDER)[number];

const rung = (name: PriorityRung): number => PRIORITY_LADDER.indexOf(name);

const CATEGORY_PRIORITY = {
  benefits: rung("no-standalone-intent"),
  "bills-utilities": rung("utilities"),
  "car-fuel": rung("bolted-on-forecourt"),
  "cash-withdrawal": rung("no-standalone-intent"),
  crypto: rung("no-standalone-intent"),
  entertainment: rung("leisure"),
  "family-education": rung("education"),
  groceries: rung("everyday-essentials"),
  health: rung("health"),
  "internal-transfer": rung("no-standalone-intent"),
  "investment-income": rung("no-standalone-intent"),
  "loans-bank-fees": rung("financial"),
  "other-income": rung("no-standalone-intent"),
  people: rung("no-standalone-intent"),
  refunds: rung("no-standalone-intent"),
  "rent-mortgage": rung("no-standalone-intent"),
  "rental-income": rung("no-standalone-intent"),
  restaurants: rung("eating-out"),
  retirement: rung("no-standalone-intent"),
  salary: rung("no-standalone-intent"),
  savings: rung("no-standalone-intent"),
  securities: rung("no-standalone-intent"),
  "self-employment": rung("no-standalone-intent"),
  shopping: rung("bolted-on-aisle"),
  subscriptions: rung("no-standalone-intent"),
  taxes: rung("no-standalone-intent"),
  "transport-travel": rung("travel"),
  uncategorised: rung("no-standalone-intent"),
} as const satisfies Record<SpendingCategory, number>;

export const categoryPriority = (category: SpendingCategory): number =>
  CATEGORY_PRIORITY[category];
