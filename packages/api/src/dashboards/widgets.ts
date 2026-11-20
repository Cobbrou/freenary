import { z } from "zod";

import { SPENDING_CATEGORIES } from "../lib/taxonomy";

export const DASHBOARD_TITLE_CHARS = 60;

export const WIDGET_TITLE_CHARS = 60;

export const MAX_DASHBOARD_WIDGETS = 12;

export const MAX_DASHBOARDS = 30;

export const STAT_METRICS = [
  "spent_this_month",
  "income_this_month",
  "saved_this_month",
  "available_to_spend",
  "current_accounts",
  "net_worth",
] as const;

export type StatMetric = (typeof STAT_METRICS)[number];

export const dashboardTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(DASHBOARD_TITLE_CHARS);

const title = z
  .string()
  .trim()
  .min(1)
  .max(WIDGET_TITLE_CHARS)
  .optional()
  .describe("a heading of your own; leave it out to keep the widget's name");

const statWidget = z
  .object({
    metric: z.enum(STAT_METRICS),
    title,
    type: z.literal("stat"),
  })
  .describe(
    "One headline figure: spent, income or saved this month, available to spend after the month's bills, the current accounts' balance, or net worth"
  );

const spendingByWeekWidget = z
  .object({
    title,
    type: z.literal("spending_by_week"),
    weeks: z.number().int().min(4).max(12).default(7),
  })
  .describe("Weekly spending stacked by the top categories");

const incomeVsSpendingWidget = z
  .object({
    months: z.number().int().min(3).max(12).default(6),
    title,
    type: z.literal("income_vs_spending"),
  })
  .describe("Money in and money out, month by month");

const budgetsWidget = z
  .object({ title, type: z.literal("budgets") })
  .describe("This month's spending against each budget line");

const topCategoriesWidget = z
  .object({
    count: z.number().int().min(3).max(8).default(5),
    title,
    type: z.literal("top_categories"),
  })
  .describe("The categories this month's spending went to, largest first");

const upcomingBillsWidget = z
  .object({
    days: z.number().int().min(7).max(31).default(14),
    title,
    type: z.literal("upcoming_bills"),
  })
  .describe("Recurring payments due in the next days");

const netWorthWidget = z
  .object({
    months: z.number().int().min(3).max(12).default(6),
    title,
    type: z.literal("net_worth"),
  })
  .describe("Net worth today and its trend over the last months");

const accountsWidget = z
  .object({ title, type: z.literal("accounts") })
  .describe("Every bank account with its balance");

const transactionsWidget = z
  .object({
    categories: z.array(z.enum(SPENDING_CATEGORIES)).max(5).optional(),
    count: z.number().int().min(3).max(12).default(6),
    months: z.number().int().min(1).max(12).default(3),
    search: z
      .string()
      .trim()
      .max(60)
      .optional()
      .describe("free text matched against the merchant or the label"),
    title,
    type: z.literal("transactions"),
  })
  .describe(
    "The latest transactions over the last months, optionally only some categories or a merchant"
  );

export const dashboardWidgetSchema = z.discriminatedUnion("type", [
  statWidget,
  spendingByWeekWidget,
  incomeVsSpendingWidget,
  budgetsWidget,
  topCategoriesWidget,
  upcomingBillsWidget,
  netWorthWidget,
  accountsWidget,
  transactionsWidget,
]);

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export type DashboardWidgetType = DashboardWidget["type"];

export const dashboardWidgetsSchema = z
  .array(dashboardWidgetSchema)
  .min(1)
  .max(MAX_DASHBOARD_WIDGETS);
