import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { Button } from "@freenary/ui/components/button";
import { Tabs, TabsItem, TabsPanel } from "@freenary/ui/components/tabs";
import { useId } from "react";

import type { Transaction } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ListSortToggle, useHoverIntent } from "@/shared/ui/list-controls";
import { UnconvertedNote } from "@/shared/ui/unconverted-note";

import type { MonthChoice } from "../model/filter-menus";
import type { AccountChoice } from "../model/filter-suggestions";
import type { SortMode, TransactionDirection } from "../model/list-search";
import type { TransactionGrouping } from "../model/transaction-groups";
import { FilterMenus } from "./filter-menus";
import { FilterTokenSearch } from "./filter-token-search";
import { SavedFiltersMenu } from "./saved-filters-menu";
import { TransactionRows } from "./transaction-rows";

const DIRECTIONS = [
  "outgoing",
  "incoming",
] as const satisfies readonly TransactionDirection[];

const PERIOD_EMPTY_DESCRIPTIONS = {
  incoming: m.budget_transactions_empty_incoming,
  outgoing: m.budget_transactions_empty_outgoing,
} as const satisfies Record<TransactionDirection, () => string>;

const NO_MONTHS: readonly MonthChoice[] = [];

const SORT_OPTIONS = [
  { label: m.budget_sort_date, value: "date" },
  { label: m.budget_sort_amount, value: "amount" },
] as const satisfies readonly { label: () => string; value: SortMode }[];

export const TransactionList = ({
  accountId,
  accounts,
  emptyDescriptions = PERIOD_EMPTY_DESCRIPTIONS,
  months = NO_MONTHS,
  onMonthPick,
  transactions,
  currency,
  totals,
  direction,
  onDirectionChange,
  onDirectionIntent,
  from,
  to,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  onSearchReplace,
  sort,
  onSortChange,
  onSortIntent,
  hasMore,
  onLoadMore,
  isLoading,
  isError,
  isRetrying,
  onRetry,
  isStale,
  onTransactionClick,
  grouping,
}: {
  accountId?: string;
  accounts: readonly AccountChoice[];
  emptyDescriptions?: Record<TransactionDirection, () => string>;
  months?: readonly MonthChoice[];
  onMonthPick?: (choice: MonthChoice) => void;
  transactions: Transaction[];
  currency: string;
  totals: { incoming: number; outgoing: number; unconvertedCount: number };
  direction: TransactionDirection;
  onDirectionChange: (dir: TransactionDirection) => void;
  onDirectionIntent: (dir: TransactionDirection) => void;
  from: Date;
  to: Date;
  search: string;
  onSearchChange: (search: string) => void;
  filters: TransactionFilter[];
  onFiltersChange: (filters: TransactionFilter[]) => void;
  onSearchReplace: (next: {
    filters: TransactionFilter[];
    search: string;
  }) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  onSortIntent: (sort: SortMode) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  isStale: boolean;
  onTransactionClick: (tx: Transaction) => void;
  grouping: TransactionGrouping;
}) => {
  const directionIntent = useHoverIntent(onDirectionIntent);
  const hasAnything = filters.length > 0 || search.trim() !== "";
  const clearAll = () => onSearchReplace({ filters: [], search: "" });
  const tabsId = useId();
  const selectedIndex = DIRECTIONS.indexOf(direction);

  const handleDirectionSelect = (index: number) => {
    const next = DIRECTIONS[index];

    if (next) {
      onDirectionChange(next);
    }
  };

  const outgoingLabel = isError
    ? m.budget_tab_outgoing_unknown()
    : m.budget_tab_outgoing({
        amount: formatCurrency(Math.abs(totals.outgoing), currency),
      });

  const incomingLabel = isError
    ? m.budget_tab_incoming_unknown()
    : m.budget_tab_incoming({
        amount: formatCurrency(totals.incoming, currency),
      });

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <FilterTokenSearch
          accountId={accountId}
          accounts={accounts}
          currency={currency}
          direction={direction}
          filters={filters}
          from={from}
          onClear={clearAll}
          onFiltersChange={onFiltersChange}
          onSearchChange={onSearchChange}
          search={search}
          to={to}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenus
            accounts={accounts}
            currency={currency}
            filters={filters}
            months={months}
            onFiltersChange={onFiltersChange}
            onMonthPick={onMonthPick}
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {hasAnything ? (
              <Button onClick={clearAll} size="compact" variant="ghost">
                {m.budget_filter_clear_all()}
              </Button>
            ) : null}
            <SavedFiltersMenu
              filters={filters}
              onApply={onSearchReplace}
              search={search}
            />
            <ListSortToggle
              label={m.budget_sort_label()}
              onChange={onSortChange}
              onIntent={onSortIntent}
              options={SORT_OPTIONS.map((option) => ({
                label: option.label(),
                value: option.value,
              }))}
              value={sort}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <Tabs
          idPrefix={tabsId}
          onSelect={handleDirectionSelect}
          selectedIndex={selectedIndex}
        >
          {DIRECTIONS.map((candidate, index) => (
            <TabsItem
              index={index}
              key={candidate}
              label={candidate === "incoming" ? incomingLabel : outgoingLabel}
              {...(direction === candidate
                ? undefined
                : directionIntent(candidate))}
            />
          ))}
        </Tabs>
        {isError ? null : (
          <UnconvertedNote
            className="px-1 pt-2"
            counts={{ transactions: totals.unconvertedCount }}
          />
        )}
        {DIRECTIONS.map((candidate, index) => (
          <TabsPanel
            className="flex flex-1 flex-col"
            idPrefix={tabsId}
            index={index}
            key={candidate}
            selectedIndex={selectedIndex}
          >
            <TransactionRows
              transactions={transactions}
              hasMore={hasMore}
              onLoadMore={onLoadMore}
              isLoading={isLoading}
              isError={isError}
              isRetrying={isRetrying}
              onRetry={onRetry}
              isIncoming={candidate === "incoming"}
              isStale={isStale}
              onTransactionClick={onTransactionClick}
              grouping={grouping}
              emptyDescription={emptyDescriptions[candidate]()}
            />
          </TabsPanel>
        ))}
      </div>
    </div>
  );
};
