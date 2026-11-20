import type {
  DashboardWidget,
  DashboardWidgetType,
} from "@freenary/api/dashboards/widgets";
import { cn } from "@freenary/ui/lib/utils";
import { Match } from "effect";

import { AccountsWidget } from "./accounts-widget";
import { BudgetsWidget } from "./budgets-widget";
import { IncomeVsSpendingWidget } from "./income-vs-spending-widget";
import { NetWorthWidget } from "./net-worth-widget";
import { SpendingByWeekWidget } from "./spending-by-week-widget";
import { StatWidget } from "./stat-widget";
import { TopCategoriesWidget } from "./top-categories-widget";
import { TransactionsWidget } from "./transactions-widget";
import { UpcomingBillsWidget } from "./upcoming-bills-widget";

interface DashboardWidgetViewProps {
  onAsk?: (question: string) => void;
  today: Date;
  widget: DashboardWidget;
}

interface DashboardGridProps {
  onAsk?: (question: string) => void;
  today: Date;
  widgets: readonly DashboardWidget[];
}

const WIDGET_SPANS = {
  accounts: "@2xl/dashboard:col-span-6",
  budgets: "@2xl/dashboard:col-span-3",
  income_vs_spending: "@2xl/dashboard:col-span-3",
  net_worth: "@2xl/dashboard:col-span-6",
  spending_by_week: "@2xl/dashboard:col-span-6",
  stat: "self-stretch @2xl/dashboard:col-span-2",
  top_categories: "@2xl/dashboard:col-span-3",
  transactions: "@2xl/dashboard:col-span-6",
  upcoming_bills: "@2xl/dashboard:col-span-3",
} satisfies Record<DashboardWidgetType, string>;

const DashboardWidgetView = ({
  onAsk,
  today,
  widget,
}: DashboardWidgetViewProps) =>
  Match.value(widget).pipe(
    Match.discriminatorsExhaustive("type")({
      accounts: ({ title }) => <AccountsWidget title={title} />,
      budgets: ({ title }) => <BudgetsWidget title={title} today={today} />,
      income_vs_spending: ({ months, title }) => (
        <IncomeVsSpendingWidget months={months} title={title} today={today} />
      ),
      net_worth: ({ months, title }) => (
        <NetWorthWidget months={months} title={title} today={today} />
      ),
      spending_by_week: ({ title, weeks }) => (
        <SpendingByWeekWidget title={title} today={today} weeks={weeks} />
      ),
      stat: ({ metric, title }) => (
        <StatWidget metric={metric} title={title} today={today} />
      ),
      top_categories: ({ count, title }) => (
        <TopCategoriesWidget
          count={count}
          onAsk={onAsk}
          title={title}
          today={today}
        />
      ),
      transactions: ({ categories, count, months, search, title }) => (
        <TransactionsWidget
          categories={categories}
          count={count}
          months={months}
          search={search}
          title={title}
          today={today}
        />
      ),
      upcoming_bills: ({ days, title }) => (
        <UpcomingBillsWidget days={days} title={title} today={today} />
      ),
    })
  );

export const DashboardGrid = ({
  onAsk,
  today,
  widgets,
}: DashboardGridProps) => (
  <div className="@container/dashboard">
    <div className="grid grid-cols-1 items-start gap-3 @2xl/dashboard:grid-cols-6">
      {widgets.map((widget, position) => (
        <div
          className={cn("min-w-0", WIDGET_SPANS[widget.type])}
          key={`${position}-${widget.type}`}
        >
          <DashboardWidgetView onAsk={onAsk} today={today} widget={widget} />
        </div>
      ))}
    </div>
  </div>
);
