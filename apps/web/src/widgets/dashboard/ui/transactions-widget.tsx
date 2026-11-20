import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  TransactionDetailDrawer,
  TransactionItem,
} from "@/features/transaction-details";
import { m } from "@/paraglide/messages.js";

import { transactionFiltersOf, useWidgetTransactions } from "../model/queries";
import {
  WidgetAction,
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetLoading,
} from "./widget-card";

interface TransactionsWidgetProps {
  categories?: SpendingCategory[];
  count: number;
  months: number;
  search?: string;
  title?: string;
  today: Date;
}

const SKELETON_ROWS = 4;

export const TransactionsWidget = ({
  categories,
  count,
  months,
  search,
  title,
  today,
}: TransactionsWidgetProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useWidgetTransactions(today, {
    categories,
    count,
    months,
    search,
  });

  const transactions = query.data?.transactions ?? [];
  const selected =
    transactions.find((transaction) => transaction.id === selectedId) ?? null;

  return (
    <WidgetCard
      action={
        <WidgetAction>
          <Link
            search={{ filters: transactionFiltersOf(categories), q: search }}
            to="/budget/transactions"
          >
            {m.home_recent_all()}
          </Link>
        </WidgetAction>
      }
      headingLevel="h3"
      title={title ?? m.home_recent_title()}
    >
      {query.isPending ? (
        <WidgetLoading label={m.home_recent_loading()}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div className="flex items-center gap-3" key={index}>
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.home_recent_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data && transactions.length === 0 ? (
        <WidgetEmpty>{m.widget_transactions_empty()}</WidgetEmpty>
      ) : null}
      {transactions.length > 0 ? (
        <ul className="flex flex-col">
          {transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              onSelect={(picked) => setSelectedId(picked.id)}
              today={today}
              transaction={transaction}
            />
          ))}
        </ul>
      ) : null}
      <TransactionDetailDrawer
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId !== null}
        transaction={selected}
      />
    </WidgetCard>
  );
};
