import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
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
import { Skeleton } from "@freenary/ui/components/skeleton";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { TransactionAmount, transactionTitle } from "@/entities/budget";
import { CategoryIcon, SpendingCategoryPicker } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { useTransactionsToCheck } from "../model/use-transactions-to-check";
import type { TransactionToCheck } from "../model/use-transactions-to-check";

const SKELETON_ROWS = ["first", "second", "third", "fourth"] as const;

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  weekday: "short",
};

const CONFIRM_SELECTOR = "[data-to-check-confirm]";

const ToCheckRow = ({
  onConfirm,
  transaction,
}: {
  onConfirm: (
    transaction: TransactionToCheck,
    category: SpendingCategory
  ) => void;
  transaction: TransactionToCheck;
}) => {
  const title = transactionTitle(transaction);
  const day = new Date(transaction.date).toLocaleDateString(
    getLocale(),
    DAY_FORMAT
  );

  return (
    <li
      className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-b-0"
      data-to-check-id={transaction.id}
    >
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <CategoryIcon
          {...predefinedCategoryAppearance(transaction.category)}
          className="size-8 [&_svg]:size-[18px]"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] leading-[18px] font-medium break-words">
            {title}
          </span>
          <span className="text-muted-foreground text-xs break-words">
            {m.to_check_row_meta({ account: transaction.accountName, day })}
          </span>
        </div>
        <TransactionAmount
          amount={transaction.amount}
          className="shrink-0 text-[13px] font-medium"
          currency={transaction.currency}
        />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <SpendingCategoryPicker
          className="w-[200px]"
          currency={transaction.currency}
          direction={transaction.amount > 0 ? "incoming" : "outgoing"}
          onValueChange={(category) => onConfirm(transaction, category)}
          value={transaction.category}
        />
        <Button
          aria-label={m.to_check_looks_right({ title })}
          data-to-check-confirm=""
          onClick={() => onConfirm(transaction, transaction.category)}
          size="icon-compact"
          title={m.to_check_looks_right_tooltip()}
          variant="tertiary"
        >
          <RiCheckLine aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
};

const ToCheckSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <output className="sr-only">{m.to_check_loading()}</output>
    {SKELETON_ROWS.map((row) => (
      <div
        aria-hidden="true"
        className="flex items-center gap-3 py-3"
        key={row}
      >
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-7 w-[200px]" />
        <Skeleton className="size-7" />
      </div>
    ))}
  </div>
);

const nextConfirmButton = (
  list: HTMLElement | null,
  transactionId: string
): HTMLElement | null => {
  const rows = [
    ...(list?.querySelectorAll<HTMLElement>("[data-to-check-id]") ?? []),
  ];

  const index = rows.findIndex(
    (row) => row.dataset.toCheckId === transactionId
  );

  const neighbour = rows[index + 1] ?? rows[index - 1];

  return neighbour?.querySelector<HTMLElement>(CONFIRM_SELECTOR) ?? null;
};

const ToCheckBody = ({
  closeRef,
  notificationId,
  onEmptied,
}: {
  closeRef: RefObject<HTMLButtonElement | null>;
  notificationId: string;
  onEmptied: () => void;
}) => {
  const toCheck = useTransactionsToCheck(notificationId);
  const listRef = useRef<HTMLUListElement>(null);
  const { query, transactions } = toCheck;
  const isEmptied = query.isSuccess && transactions.length === 0;

  useEffect(() => {
    if (isEmptied) {
      onEmptied();
    }
  }, [isEmptied, onEmptied]);

  const handleConfirm = (
    transaction: TransactionToCheck,
    category: SpendingCategory
  ) => {
    const target = nextConfirmButton(listRef.current, transaction.id);

    toCheck.confirm(transaction, category);
    (target ?? closeRef.current)?.focus();
  };

  return (
    <>
      <DrawerHeader className="flex-row items-start gap-2 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <DrawerTitle className="text-base">{m.to_check_title()}</DrawerTitle>
          <DrawerDescription className="text-balance">
            {m.to_check_description({ count: transactions.length })}
          </DrawerDescription>
        </div>
        <Button
          disabled={transactions.length === 0}
          onClick={() => {
            toCheck.clear();
            onEmptied();
          }}
          size="compact"
          variant="ghost"
        >
          {m.to_check_dismiss_all()}
        </Button>
        <DrawerClose
          render={<Button ref={closeRef} size="icon-compact" variant="ghost" />}
        >
          <RiCloseLine aria-hidden="true" />
          <span className="sr-only">{m.to_check_close()}</span>
        </DrawerClose>
      </DrawerHeader>
      <div className="border-border mx-5 border-t" />
      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-5 pb-4">
        {query.isPending ? <ToCheckSkeleton /> : null}
        {query.isError ? (
          <div className="flex flex-col items-start gap-2 py-4">
            <p className="text-muted-foreground text-sm">
              {m.to_check_error()}
            </p>
            <Button
              loading={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
              size="compact"
              variant="secondary"
            >
              {m.to_check_retry()}
            </Button>
          </div>
        ) : null}
        {transactions.length > 0 ? (
          <ul className="flex flex-col" ref={listRef}>
            {transactions.map((transaction) => (
              <ToCheckRow
                key={transaction.id}
                onConfirm={handleConfirm}
                transaction={transaction}
              />
            ))}
          </ul>
        ) : null}
      </ScrollArea>
    </>
  );
};

export const TransactionsToCheckDrawer = ({
  finalFocus,
  notificationId,
  onOpenChange,
  open,
}: {
  finalFocus?: RefObject<HTMLElement | null>;
  notificationId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [shownId, setShownId] = useState(notificationId);

  if (notificationId !== null && notificationId !== shownId) {
    setShownId(notificationId);
  }

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Drawer onOpenChange={onOpenChange} open={open} swipeDirection="right">
      <DrawerContent
        className="w-full sm:max-w-[37.5rem]"
        finalFocus={finalFocus}
        initialFocus={closeRef}
      >
        {shownId === null ? null : (
          <ToCheckBody
            closeRef={closeRef}
            notificationId={shownId}
            onEmptied={close}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
};
