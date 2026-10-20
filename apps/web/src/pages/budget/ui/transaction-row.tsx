import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { useCallback, useRef } from "react";

import { CategoryIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { Transaction } from "../model/transaction";

export const CATEGORY_MEDIA_BOX = {
  compact: "size-7 [&_svg]:size-3.5",
  default: "size-9 [&_svg]:size-4",
} as const;

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

  const title = transaction.counterpartyName ?? transaction.description;
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
        {transaction.counterpartyName && transaction.description ? (
          <ItemDescription className="block truncate">
            {transaction.description}
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemContent
        className={cn(
          "font-medium tabular-nums",
          isIncoming ? "text-success" : "text-destructive"
        )}
      >
        {isIncoming ? "+" : "−"}
        {amount}
      </ItemContent>
    </Item>
  );
};
