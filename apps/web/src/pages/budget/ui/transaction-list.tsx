import {
  TabItem,
  TabPanel,
  Tabs,
  TabsList,
} from "@freenary/ui/components/tabs";
import { RiCoinsLine } from "@remixicon/react";

import { EMPTY_CATEGORY_FILTER } from "@/entities/category";
import type { CategoryFilter } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import { useHoverIntent } from "../lib/use-hover-intent";
import type { TimeRange } from "../model/period";
import type { SortMode, TransactionDirection } from "../model/search";
import type { Transaction } from "../model/transaction";
import {
  activeFilterCount,
  EMPTY_AMOUNT_RANGE,
} from "../model/transaction-filters";
import type { AmountRange } from "../model/transaction-filters";
import { AmountFilterMenu } from "./amount-filter-menu";
import { CategoryFilterMenu } from "./category-filter-menu";
import {
  ClearFiltersButton,
  ListFilterBar,
  ListFilterChip,
  ListFilterChips,
  ListSearchInput,
  ListSortToggle,
} from "./list-controls";
import { MerchantFilterMenu } from "./merchant-filter-menu";
import { TransactionRows } from "./transaction-rows";

const amountLabel = (amount: AmountRange): string => {
  const max = formatCurrency(Math.round(amount.max * 100));
  const min = formatCurrency(Math.round(amount.min * 100));

  if (amount.min > 0 && amount.max > 0) {
    return m.budget_filter_amount_between({ max, min });
  }

  return amount.min > 0
    ? m.budget_filter_amount_from({ amount: min })
    : m.budget_filter_amount_upto({ amount: max });
};

const SORT_OPTIONS = [
  { label: m.budget_sort_date, value: "date" },
  { label: m.budget_sort_amount, value: "amount" },
] as const satisfies readonly { label: () => string; value: SortMode }[];

export const TransactionList = ({
  amount,
  transactions,
  totals,
  direction,
  onDirectionChange,
  onDirectionIntent,
  from,
  to,
  search,
  onSearchChange,
  filter,
  onAmountChange,
  onFilterChange,
  merchants,
  onMerchantsChange,
  sort,
  onSortChange,
  onSortIntent,
  hasMore,
  onLoadMore,
  isLoading,
  isStale,
  onTransactionClick,
  range,
}: {
  amount: AmountRange;
  transactions: Transaction[];
  totals: { incoming: number; outgoing: number };
  direction: TransactionDirection;
  onDirectionChange: (dir: TransactionDirection) => void;
  onDirectionIntent: (dir: TransactionDirection) => void;
  from: Date;
  to: Date;
  search: string;
  onSearchChange: (search: string) => void;
  filter: CategoryFilter;
  onAmountChange: (amount: AmountRange) => void;
  onFilterChange: (filter: CategoryFilter) => void;
  merchants: string[];
  onMerchantsChange: (merchants: string[]) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  onSortIntent: (sort: SortMode) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
  isStale: boolean;
  onTransactionClick: (tx: Transaction) => void;
  range: TimeRange;
}) => {
  const directionIntent = useHoverIntent(onDirectionIntent);

  // SAFETY: TabItem values are constrained to the two directions
  const handleDirectionChange = (value: string) =>
    onDirectionChange(value as TransactionDirection);

  const outgoingLabel = m.budget_tab_outgoing({
    amount: formatCurrency(Math.abs(totals.outgoing), "EUR"),
  });

  const incomingLabel = m.budget_tab_incoming({
    amount: formatCurrency(totals.incoming, "EUR"),
  });

  const activeCount = activeFilterCount(filter, merchants, amount);
  const hasAmountBound = amount.min > 0 || amount.max > 0;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <ListFilterBar>
        <ListSearchInput
          onChange={onSearchChange}
          placeholder={m.budget_search_placeholder()}
          value={search}
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
        <AmountFilterMenu onRangeChange={onAmountChange} range={amount} />
        <MerchantFilterMenu
          direction={direction}
          from={from}
          merchants={merchants}
          onMerchantsChange={onMerchantsChange}
          to={to}
        />
        <CategoryFilterMenu filter={filter} onFilterChange={onFilterChange} />
      </ListFilterBar>

      {(hasAmountBound || activeCount >= 2) && (
        <ListFilterChips>
          {(position) => (
            <>
              {hasAmountBound && (
                <ListFilterChip
                  icon={<RiCoinsLine className="size-3.5" />}
                  label={amountLabel(amount)}
                  onRemove={() => onAmountChange(EMPTY_AMOUNT_RANGE)}
                  position={position(0)}
                />
              )}
              {activeCount >= 2 && (
                <ClearFiltersButton
                  onClear={() => {
                    onFilterChange(EMPTY_CATEGORY_FILTER);
                    onMerchantsChange([]);
                    onAmountChange(EMPTY_AMOUNT_RANGE);
                  }}
                />
              )}
            </>
          )}
        </ListFilterChips>
      )}

      <Tabs
        value={direction}
        onValueChange={handleDirectionChange}
        className="flex flex-1 flex-col"
      >
        <TabsList>
          <TabItem
            label={outgoingLabel}
            value="outgoing"
            {...(direction === "outgoing"
              ? undefined
              : directionIntent("outgoing"))}
          />
          <TabItem
            label={incomingLabel}
            value="incoming"
            {...(direction === "incoming"
              ? undefined
              : directionIntent("incoming"))}
          />
        </TabsList>
        <TabPanel value="outgoing" className="flex flex-1 flex-col">
          <TransactionRows
            transactions={transactions}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            isLoading={isLoading}
            isIncoming={false}
            isStale={isStale}
            onTransactionClick={onTransactionClick}
            range={range}
          />
        </TabPanel>
        <TabPanel value="incoming" className="flex flex-1 flex-col">
          <TransactionRows
            transactions={transactions}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            isLoading={isLoading}
            isIncoming={true}
            isStale={isStale}
            onTransactionClick={onTransactionClick}
            range={range}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
};
