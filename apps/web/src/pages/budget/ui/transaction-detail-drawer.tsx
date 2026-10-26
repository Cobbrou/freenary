import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import { Button } from "@freenary/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@freenary/ui/components/drawer";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import { Separator } from "@freenary/ui/components/separator";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { RiCalendarLine, RiCloseLine, RiPriceTag3Line } from "@remixicon/react";
import { useEffect, useState } from "react";

import { CategoryIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import type { Transaction } from "../model/transaction";
import { useTransactionCategory } from "../model/use-transaction-category";
import { TransactionCategoryPicker } from "./transaction-category-picker";
import { TransactionDetailRow } from "./transaction-detail-row";
import { CATEGORY_MEDIA_BOX } from "./transaction-row";

const HERO_BOX = {
  compact: "size-10 [&_svg]:size-5",
  default: "size-12 [&_svg]:size-6",
} as const;

const TransactionDetails = ({ transaction }: { transaction: Transaction }) => {
  const updateCategory = useTransactionCategory(transaction);
  const { variant } = useSize();

  const isIncoming = transaction.amount > 0;
  const isOverridden = transaction.category !== transaction.derivedCategory;
  const displayDate = new Date(transaction.date).toLocaleDateString(
    getLocale(),
    {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      weekday: "short",
      year: "numeric",
    }
  );

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{m.budget_detail_title()}</DrawerTitle>
        <DrawerDescription className="sr-only">
          {m.budget_detail_sr_description()}
        </DrawerDescription>
        <DrawerClose
          render={
            <Button
              className="absolute end-4 top-4"
              size="icon-compact"
              variant="ghost"
            />
          }
        >
          <RiCloseLine />
          <span className="sr-only">{m.budget_detail_close()}</span>
        </DrawerClose>
      </DrawerHeader>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="p-4 pt-0">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 pt-2">
            <CategoryIcon
              {...predefinedCategoryAppearance(transaction.category)}
              className={HERO_BOX[variant]}
            />
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  isIncoming ? "text-success" : "text-foreground"
                )}
              >
                {isIncoming ? "+" : "−"}
                {formatCurrency(
                  Math.abs(transaction.amount),
                  transaction.currency
                )}
              </span>
              <span className="text-muted-foreground text-sm">
                {transaction.counterpartyName ?? transaction.description}
              </span>
            </div>
          </div>

          <Separator />

          <ul className="flex flex-col gap-2.5">
            <TransactionDetailRow
              icon={<RiCalendarLine />}
              label={m.budget_detail_date_label()}
            >
              <span className="text-sm">{displayDate}</span>
            </TransactionDetailRow>

            {transaction.counterpartyName && transaction.description ? (
              <TransactionDetailRow
                icon={<RiPriceTag3Line />}
                label={m.budget_detail_description_label()}
              >
                <span className="text-sm">{transaction.description}</span>
              </TransactionDetailRow>
            ) : null}

            <TransactionDetailRow
              label={m.budget_detail_category_label()}
              media={
                <CategoryIcon
                  {...predefinedCategoryAppearance(transaction.category)}
                  className={CATEGORY_MEDIA_BOX[variant]}
                />
              }
            >
              <TransactionCategoryPicker
                category={transaction.category}
                direction={isIncoming ? "incoming" : "outgoing"}
                isOverridden={isOverridden}
                onSelect={(category) => updateCategory.mutate(category)}
                onReset={() => updateCategory.mutate(null)}
              />
            </TransactionDetailRow>
          </ul>
        </div>
      </ScrollArea>
    </>
  );
};

export const TransactionDetailDrawer = ({
  onOpenChange,
  open,
  transaction,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  transaction: Transaction | null;
}) => {
  const [shownDuringExitAnimation, setShownDuringExitAnimation] =
    useState(transaction);

  if (transaction !== null && transaction !== shownDuringExitAnimation) {
    setShownDuringExitAnimation(transaction);
  }

  useEffect(() => {
    const selectionDroppedOutOfResults = open && transaction === null;

    if (selectionDroppedOutOfResults) {
      onOpenChange(false);
    }
  }, [onOpenChange, open, transaction]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent className="w-full sm:max-w-md">
        {shownDuringExitAnimation === null ? null : (
          <TransactionDetails transaction={shownDuringExitAnimation} />
        )}
      </DrawerContent>
    </Drawer>
  );
};
