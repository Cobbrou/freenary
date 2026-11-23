import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { useSize } from "@freenary/ui/lib/size-context";
import { useCallback, useRef } from "react";

import {
  CATEGORY_MEDIA_BOX,
  TransactionAmount,
  transactionTitle,
} from "@/entities/budget";
import type { Transaction } from "@/entities/budget";
import { CategoryIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

export const TransactionRow = ({
  transaction,
  isIncoming,
  index,
  offset,
  measureRef,
  registerItem,
  onClick,
}: {
  transaction: Transaction;
  isIncoming: boolean;
  index: number;
  offset: number;
  measureRef: (node: Element | null) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
  onClick: () => void;
}) => {
  const amount = formatCurrency(
    Math.abs(transaction.amount),
    transaction.currency
  );

  const title = transactionTitle(transaction);
  const { variant } = useSize();

  const rowRef = useRef<HTMLDivElement | null>(null);
  useRegisterFluidHoverItem(registerItem, index, rowRef);
  const setRow = useCallback(
    (node: HTMLDivElement | null) => {
      rowRef.current = node;
      measureRef(node);
    },
    [measureRef]
  );

  return (
    <Item
      className="border-b-border absolute inset-x-0 cursor-pointer text-start"
      data-index={index}
      ref={setRow}
      render={
        <button
          aria-label={
            isIncoming
              ? m.budget_transaction_received({ amount, title })
              : m.budget_transaction_paid({ amount, title })
          }
          type="button"
        />
      }
      size="sm"
      style={{ top: offset }}
      onClick={onClick}
    >
      <ItemMedia>
        <CategoryIcon
          {...predefinedCategoryAppearance(transaction.category)}
          className={CATEGORY_MEDIA_BOX[variant]}
        />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="block w-full truncate">{title}</ItemTitle>
      </ItemContent>
      <ItemContent className="font-medium">
        <TransactionAmount
          amount={transaction.amount}
          currency={transaction.currency}
        />
      </ItemContent>
    </Item>
  );
};
