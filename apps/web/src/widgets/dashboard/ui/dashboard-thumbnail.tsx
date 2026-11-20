import type { DashboardWidgetType } from "@freenary/api/dashboards/widgets";
import { cn } from "@freenary/ui/lib/utils";

const THUMBNAIL_SPANS = {
  accounts: "col-span-6",
  budgets: "col-span-3",
  income_vs_spending: "col-span-3",
  net_worth: "col-span-6",
  spending_by_week: "col-span-6",
  stat: "col-span-2",
  top_categories: "col-span-3",
  transactions: "col-span-6",
  upcoming_bills: "col-span-3",
} satisfies Record<DashboardWidgetType, string>;

const THUMBNAIL_HEIGHTS = {
  accounts: "h-3",
  budgets: "h-4",
  income_vs_spending: "h-4",
  net_worth: "h-5",
  spending_by_week: "h-5",
  stat: "h-2.5",
  top_categories: "h-4",
  transactions: "h-4",
  upcoming_bills: "h-4",
} satisfies Record<DashboardWidgetType, string>;

const BLOCKS_SHOWN = 6;

export const DashboardThumbnail = ({
  widgetTypes,
}: {
  widgetTypes: readonly DashboardWidgetType[];
}) => (
  <div
    aria-hidden="true"
    className="bg-muted/60 grid h-20 grid-cols-6 content-start gap-1 overflow-hidden rounded-lg p-2"
  >
    {widgetTypes.slice(0, BLOCKS_SHOWN).map((type, position) => (
      <span
        className={cn(
          "bg-primary/25 rounded-[3px]",
          THUMBNAIL_SPANS[type],
          THUMBNAIL_HEIGHTS[type]
        )}
        key={`${position}-${type}`}
      />
    ))}
  </div>
);
