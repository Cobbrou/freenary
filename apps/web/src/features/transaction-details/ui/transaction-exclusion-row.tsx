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
import { ExclusionReasonField } from "@/shared/ui/exclusion-reason-field";

import { exclusionActionsOf } from "../model/exclusion-actions";
import { useTransactionExclusion } from "../model/use-transaction-exclusion";

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

const EXCLUSION_DESCRIPTIONS = {
  ACCOUNT: m.budget_detail_excluded_account,
  MERCHANT: m.budget_detail_excluded_merchant,
};

export const TransactionExclusionRow = ({
  transaction,
}: {
  transaction: Transaction;
}) => {
  const exclusion = useTransactionExclusion(transaction);
  const labelId = useId();
  const excludedBy = transaction.exclusion ?? null;
  const reason = transaction.exclusionReason ?? null;

  if (transaction.category === INTERNAL_TRANSFER_CATEGORY) {
    return null;
  }

  return (
    <>
      <Item className="px-0" render={<li />} size="sm">
        <ItemContent>
          <ItemTitle id={labelId}>{m.budget_detail_exclude_label()}</ItemTitle>
          {excludedBy === "ACCOUNT" || excludedBy === "MERCHANT" ? (
            <ItemDescription className="text-pretty">
              {EXCLUSION_DESCRIPTIONS[excludedBy]()}
            </ItemDescription>
          ) : null}
          {excludedBy === "ACCOUNT" && reason !== null ? (
            <ItemDescription className="text-pretty break-words">
              {m.exclusion_reason_value({ reason })}
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions>
          <Switch
            aria-labelledby={labelId}
            checked={isExcluded(transaction)}
            disabled={excludedBy === "ACCOUNT" || excludedBy === "MERCHANT"}
            onCheckedChange={(next) =>
              exclusion.mutate({ isExcluded: next, scope: "transaction" })
            }
          />
        </ItemActions>
      </Item>
      {excludedBy === "TRANSACTION" || excludedBy === "MERCHANT" ? (
        <li>
          <ExclusionReasonField
            disabled={exclusion.isPending}
            key={transaction.id}
            onSave={(next) =>
              exclusion.mutate({
                isExcluded: true,
                reason: next,
                scope: excludedBy === "MERCHANT" ? "merchant" : "transaction",
              })
            }
            reason={reason}
          />
        </li>
      ) : null}
    </>
  );
};
