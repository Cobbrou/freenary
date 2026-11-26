import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import { cn } from "@freenary/ui/lib/utils";

import {
  isExcluded,
  TransactionAmount,
  transactionTitle,
} from "@/entities/budget";
import type { Transaction } from "@/entities/budget";
import { CategoryIcon, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { bankDayLabel } from "../lib/day-label";

export const TransactionItem = ({
  onSelect,
  today,
  transaction,
}: {
  onSelect: (transaction: Transaction) => void;
  today: Date;
  transaction: Transaction;
}) => (
  <li>
    <button
      className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors duration-100 outline-none focus-visible:ring-[3px]"
      onClick={() => onSelect(transaction)}
      type="button"
    >
      <CategoryIcon
        {...predefinedCategoryAppearance(transaction.category)}
        className="size-9 shrink-0 [&_svg]:size-4"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {transactionTitle(transaction)}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {(isExcluded(transaction)
            ? m.budget_transaction_meta_excluded
            : m.budget_transaction_meta)({
            category: categoryLabel(transaction.category),
            day: bankDayLabel(transaction.date, today, getLocale()),
          })}
        </span>
      </span>
      <TransactionAmount
        amount={transaction.amount}
        className={cn(
          "text-sm font-medium",
          isExcluded(transaction) && "text-muted-foreground line-through"
        )}
        currency={transaction.currency}
      />
    </button>
  </li>
);
