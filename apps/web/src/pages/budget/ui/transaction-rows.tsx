import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { useFluidHover } from "@freenary/ui/hooks/use-fluid-hover";
import { RiReceiptLine } from "@remixicon/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import type { TimeRange } from "../model/period";
import type { Transaction } from "../model/transaction";
import {
  buildVirtualItems,
  HEADER_HEIGHT,
  ROW_HEIGHT,
} from "../model/transaction-groups";
import { LoadError } from "./load-error";
import { StaleRegion } from "./stale-region";
import { TransactionGroupHeader } from "./transaction-group-header";
import { TransactionRow } from "./transaction-row";
import { TransactionRowsSkeleton } from "./transaction-rows-skeleton";

const ROWS_BEFORE_END_TO_PREFETCH = 5;

const ROWS_WHILE_EMPTY = 6;

export const TransactionRows = ({
  transactions,
  hasMore,
  onLoadMore,
  isLoading,
  isError,
  isRetrying,
  onRetry,
  isIncoming,
  isStale,
  onTransactionClick,
  range,
}: {
  transactions: Transaction[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  isIncoming: boolean;
  isStale: boolean;
  onTransactionClick: (tx: Transaction) => void;
  range: TimeRange;
}) => {
  "use no memo";
  const parentRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(parentRef, { gapClick: false });
  const { handlers, registerItem, remeasure } = hover;

  const locale = getLocale();
  const virtualItems = useMemo(
    () => buildVirtualItems(transactions, range, locale),
    [transactions, range, locale]
  );

  // eslint-disable-next-line react/incompatible-library -- useVirtualizer is inherently incompatible with React Compiler; component opts out via "use no memo"
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    estimateSize: (index) =>
      virtualItems[index]?.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    getScrollElement: () => parentRef.current,
    overscan: 10,
  });

  const visibleItems = virtualizer.getVirtualItems();
  const firstVisible = visibleItems.at(0)?.index;
  const lastVisible = visibleItems.at(-1)?.index;

  useEffect(() => {
    remeasure();
  }, [remeasure, firstVisible, lastVisible]);

  const loadMoreCheck = useCallback(() => {
    const isShowingSettledPage = !isLoading && !isStale;
    const canPageFurther = hasMore && isShowingSettledPage;

    if (!canPageFurther) {
      return;
    }

    const lastItem = visibleItems.at(-1);
    const prefetchFromIndex = virtualItems.length - ROWS_BEFORE_END_TO_PREFETCH;

    if (lastItem && lastItem.index >= prefetchFromIndex) {
      onLoadMore();
    }
  }, [
    hasMore,
    isLoading,
    isStale,
    visibleItems,
    virtualItems.length,
    onLoadMore,
  ]);

  useEffect(() => {
    loadMoreCheck();
  }, [loadMoreCheck]);

  if (isError) {
    return (
      <LoadError
        isRetrying={isRetrying}
        onRetry={onRetry}
        title={m.budget_transactions_load_error_title()}
      />
    );
  }

  if (transactions.length === 0 && isLoading) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col">
        <output className="sr-only">{m.budget_transactions_loading()}</output>
        <div aria-hidden="true">
          <TransactionRowsSkeleton rows={ROWS_WHILE_EMPTY} />
        </div>
      </div>
    );
  }

  if (transactions.length === 0 && !isLoading) {
    return (
      <StaleRegion className="flex flex-1 flex-col" isStale={isStale}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiReceiptLine />
            </EmptyMedia>
            <EmptyTitle>{m.budget_transactions_empty_title()}</EmptyTitle>
            <EmptyDescription>
              {isIncoming
                ? m.budget_transactions_empty_incoming()
                : m.budget_transactions_empty_outgoing()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </StaleRegion>
    );
  }

  return (
    <div
      aria-busy={isLoading || undefined}
      className="relative flex-1 overflow-auto"
      ref={parentRef}
      {...handlers}
    >
      <FluidHoverHighlight className="rounded-lg" hover={hover} />
      <StaleRegion isStale={isStale}>
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {visibleItems.map((virtualRow) => {
            const item = virtualItems[virtualRow.index];

            if (!item) {
              return null;
            }

            if (item.type === "header") {
              return (
                <TransactionGroupHeader
                  key={item.key}
                  label={item.label}
                  total={item.total}
                  currency={item.currency}
                  index={virtualRow.index}
                  offset={virtualRow.start}
                  measureRef={virtualizer.measureElement}
                />
              );
            }

            return (
              <TransactionRow
                key={item.key}
                transaction={item.tx}
                isIncoming={isIncoming}
                index={virtualRow.index}
                offset={virtualRow.start}
                measureRef={virtualizer.measureElement}
                registerItem={registerItem}
                onClick={() => onTransactionClick(item.tx)}
              />
            );
          })}
        </div>
        {isLoading ? (
          <>
            <output className="sr-only">
              {m.budget_transactions_loading()}
            </output>
            <div aria-hidden="true">
              <TransactionRowsSkeleton rows={3} />
            </div>
          </>
        ) : null}
      </StaleRegion>
    </div>
  );
};
