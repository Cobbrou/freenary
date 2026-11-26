import type { ExclusionScope } from "@freenary/api/lib/exclusion-scope";
import { INTERNAL_TRANSFER_CATEGORY } from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@freenary/ui/components/dropdown";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import { MenuItem } from "@freenary/ui/components/menu-item";
import { Switch } from "@freenary/ui/components/switch";
import { RiMore2Fill } from "@remixicon/react";
import { useId } from "react";

import { isExcluded } from "@/entities/budget";
import type { Transaction } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";

import { useTransactionExclusion } from "../model/use-transaction-exclusion";

interface ExclusionAction {
  isExcluded: boolean;
  label: string;
  scope: ExclusionScope;
}

const exclusionActionsOf = (transaction: Transaction): ExclusionAction[] => {
  if (transaction.exclusion === "MERCHANT") {
    return [
      {
        isExcluded: false,
        label: m.budget_detail_include_merchant(),
        scope: "merchant",
      },
    ];
  }

  const canExcludeMerchant =
    transaction.hasMerchant === true &&
    transaction.category !== INTERNAL_TRANSFER_CATEGORY;

  return canExcludeMerchant
    ? [
        {
          isExcluded: true,
          label: m.budget_detail_exclude_merchant(),
          scope: "merchant",
        },
      ]
    : [];
};

export const TransactionActionsMenu = ({
  className,
  transaction,
}: {
  className?: string;
  transaction: Transaction;
}) => {
  const exclusion = useTransactionExclusion(transaction);
  const actions = exclusionActionsOf(transaction);

  if (actions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button className={className} size="icon-compact" variant="ghost" />
        }
      >
        <RiMore2Fill />
        <span className="sr-only">{m.budget_detail_actions()}</span>
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-52">
        {actions.map((action, index) => (
          <MenuItem
            index={index}
            key={action.label}
            label={action.label}
            onSelect={() =>
              exclusion.mutate({
                isExcluded: action.isExcluded,
                scope: action.scope,
              })
            }
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
};

export const TransactionExclusionRow = ({
  transaction,
}: {
  transaction: Transaction;
}) => {
  const exclusion = useTransactionExclusion(transaction);
  const labelId = useId();
  const isByMerchant = transaction.exclusion === "MERCHANT";

  if (transaction.category === INTERNAL_TRANSFER_CATEGORY) {
    return null;
  }

  return (
    <Item className="px-0" render={<li />} size="sm">
      <ItemContent>
        <ItemTitle id={labelId}>{m.budget_detail_exclude_label()}</ItemTitle>
        {isByMerchant ? (
          <ItemDescription className="text-pretty">
            {m.budget_detail_excluded_merchant()}
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        <Switch
          aria-labelledby={labelId}
          checked={isExcluded(transaction)}
          disabled={isByMerchant}
          onCheckedChange={(next) =>
            exclusion.mutate({ isExcluded: next, scope: "transaction" })
          }
        />
      </ItemActions>
    </Item>
  );
};
