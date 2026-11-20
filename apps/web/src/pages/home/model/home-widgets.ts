import type { DashboardWidget } from "@freenary/api/dashboards/widgets";

export const HOME_WIDGETS = [
  { metric: "spent_this_month", type: "stat" },
  { metric: "available_to_spend", type: "stat" },
  { metric: "saved_this_month", type: "stat" },
  { type: "spending_by_week", weeks: 7 },
  { months: 6, type: "income_vs_spending" },
  { type: "budgets" },
  { count: 5, type: "top_categories" },
  { days: 14, type: "upcoming_bills" },
  { months: 6, type: "net_worth" },
] as const satisfies readonly DashboardWidget[];
