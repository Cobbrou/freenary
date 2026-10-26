import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { Skeleton } from "@freenary/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freenary/ui/components/table";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { RiRepeatLine } from "@remixicon/react";

import { categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import { localDayOfBankDate } from "../model/period";
import {
  frequencyLabel,
  relativeDayLabel,
  sectionEmptyLabel,
  sectionLabel,
} from "../model/recurrence-labels";
import {
  annualCostMinor,
  dayDelta,
  merchantLabel,
  monthlyEquivalentMinor,
  UPCOMING_HORIZON_DAYS,
} from "../model/recurring";
import type { RecurrenceKind, RecurringItem } from "../model/recurring";
import { ConfidenceBadge } from "./recurrence-badge";

interface RecurringTableProps {
  asOf: Date;
  hasFilters: boolean;
  isError: boolean;
  isPending: boolean;
  items: RecurringItem[];
  kind: RecurrenceKind;
}

const FREQUENCY_COLUMN = "hidden @min-[40rem]/budget:table-cell";
const MONTHLY_COLUMN = "hidden @min-[52rem]/budget:table-cell";
const WIDEST_COLUMN = "hidden @min-[60rem]/budget:table-cell";

const MONEY_CELL = "text-end font-mono tabular-nums";

const COLUMN_COUNT = 7;

const ROW_CONTROL_HEIGHTS = 2;

const SKELETON_ROWS = 6;

const AMOUNT_SPREAD_APPROX = 0.05;

const RecurringTableHead = () => (
  <TableHeader>
    <TableRow>
      <TableHead>{m.budget_recurring_column_merchant()}</TableHead>
      <TableHead>{m.budget_recurring_column_confidence()}</TableHead>
      <TableHead className="text-end">
        {m.budget_recurring_column_amount()}
      </TableHead>
      <TableHead className={FREQUENCY_COLUMN}>
        {m.budget_recurring_column_frequency()}
      </TableHead>
      <TableHead className="text-end">
        {m.budget_recurring_column_next()}
      </TableHead>
      <TableHead className={cn(MONTHLY_COLUMN, "text-end")}>
        {m.budget_recurring_column_monthly()}
      </TableHead>
      <TableHead className={cn(WIDEST_COLUMN, "text-end")}>
        {m.budget_recurring_column_annual()}
      </TableHead>
    </TableRow>
  </TableHeader>
);

const ItemRow = ({ asOf, item }: { asOf: Date; item: RecurringItem }) => {
  const { controlHeight } = useSize();
  const amount = formatCurrency(item.typicalAmountMinor, item.currency);
  const next = localDayOfBankDate(item.nextExpected);
  const daysAway = dayDelta(asOf, next);
  const isWithinUpcomingHorizon =
    daysAway >= 0 && daysAway <= UPCOMING_HORIZON_DAYS;

  return (
    <TableRow style={{ height: controlHeight * ROW_CONTROL_HEIGHTS }}>
      <TableCell className="max-w-56">
        <span className="block truncate font-medium">
          {merchantLabel(item)}
        </span>
        <span className="text-muted-foreground block truncate">
          {categoryLabel(item.category)}
        </span>
      </TableCell>
      <TableCell>
        <ConfidenceBadge confidence={item.confidence} />
      </TableCell>
      <TableCell className={MONEY_CELL}>
        {item.amountSpread > AMOUNT_SPREAD_APPROX
          ? m.budget_recurring_amount_approx({ amount })
          : amount}
      </TableCell>
      <TableCell className={FREQUENCY_COLUMN}>
        {frequencyLabel(item.frequency)}
      </TableCell>
      <TableCell className={MONEY_CELL}>
        <span className="block">
          {next.toLocaleDateString(getLocale(), {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        {isWithinUpcomingHorizon && (
          <span className="text-muted-foreground block font-sans">
            {relativeDayLabel(daysAway)}
          </span>
        )}
      </TableCell>
      <TableCell className={cn(MONTHLY_COLUMN, MONEY_CELL)}>
        {formatCurrency(monthlyEquivalentMinor(item), item.currency)}
      </TableCell>
      <TableCell className={cn(WIDEST_COLUMN, MONEY_CELL)}>
        {formatCurrency(annualCostMinor(item), item.currency)}
      </TableCell>
    </TableRow>
  );
};

const SkeletonRows = () => {
  const { control, controlHeight } = useSize();

  return (
    <TableBody>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <TableRow
          key={index}
          style={{ height: controlHeight * ROW_CONTROL_HEIGHTS }}
        >
          <TableCell aria-hidden="true" colSpan={COLUMN_COUNT}>
            <Skeleton className={cn("w-full", control)} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
};

export const RecurringTable = ({
  asOf,
  hasFilters,
  isError,
  isPending,
  items,
  kind,
}: RecurringTableProps) => {
  if (isError) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center">
        {m.budget_recurring_unavailable()}
      </p>
    );
  }

  if (!isPending && items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiRepeatLine />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilters
              ? m.budget_recurring_no_match_title()
              : sectionLabel(kind)}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? m.budget_recurring_no_match_body()
              : sectionEmptyLabel(kind)}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div aria-busy={isPending}>
      {isPending && (
        <output className="sr-only">{m.budget_recurring_loading()}</output>
      )}
      <Table aria-label={m.budget_recurring_table_label()}>
        <RecurringTableHead />
        {isPending ? (
          <SkeletonRows />
        ) : (
          <TableBody>
            {items.map((item) => (
              <ItemRow asOf={asOf} item={item} key={item.merchantKey} />
            ))}
          </TableBody>
        )}
      </Table>
    </div>
  );
};
