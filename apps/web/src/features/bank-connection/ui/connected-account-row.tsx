import { Badge } from "@freenary/ui/components/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";

import { m } from "@/paraglide/messages.js";

import { connectedAccountLabel } from "../model/bank-rows";
import type { ConnectedAccount } from "../model/bank-rows";
import { DeleteAccountDialog } from "./delete-account-dialog";

interface ConnectedAccountRowProps {
  account: ConnectedAccount;
  isDeleting: boolean;
  onDelete: () => void;
}

export const ConnectedAccountRow = ({
  account,
  isDeleting,
  onDelete,
}: ConnectedAccountRowProps) => {
  const label = connectedAccountLabel(account);
  const transactions = m.bank_account_transaction_count({
    count: account.transactionCount,
  });

  return (
    <Item size="sm" variant="muted">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex w-full flex-wrap items-center gap-2 break-words">
          <span>{label}</span>
          {account.inConsent ? null : (
            <Badge
              className="-my-0.5"
              color="amber"
              size="compact"
              variant="dot"
            >
              {m.bank_account_not_shared()}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {account.inConsent
            ? transactions
            : `${transactions} · ${m.bank_account_not_shared_detail()}`}
        </ItemDescription>
      </ItemContent>
      {account.inConsent ? null : (
        <ItemActions>
          <DeleteAccountDialog
            accountName={label}
            isDeleting={isDeleting}
            onConfirm={onDelete}
            transactionCount={account.transactionCount}
          />
        </ItemActions>
      )}
    </Item>
  );
};
