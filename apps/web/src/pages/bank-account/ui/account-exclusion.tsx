import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import { Switch } from "@freenary/ui/components/switch";
import { useId } from "react";

import type { PortfolioAccount } from "@/entities/account";
import { m } from "@/paraglide/messages.js";
import { ExclusionReasonField } from "@/shared/ui/exclusion-reason-field";

import { useAccountExclusion } from "../model/use-account-exclusion";

export const AccountExclusion = ({
  account,
}: {
  account: PortfolioAccount;
}) => {
  const exclusion = useAccountExclusion(account);
  const labelId = useId();
  const descriptionId = useId();

  return (
    <section
      aria-labelledby={labelId}
      className="bg-surface-1 shadow-surface-1 flex max-w-md flex-col gap-2 rounded-xl p-3"
    >
      <Item className="p-0" size="sm">
        <ItemContent>
          <ItemTitle id={labelId}>{m.bank_account_exclude_label()}</ItemTitle>
          <ItemDescription className="text-pretty" id={descriptionId}>
            {exclusion.isExcluded
              ? m.bank_account_excluded_description()
              : m.bank_account_exclude_description()}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            aria-describedby={descriptionId}
            aria-labelledby={labelId}
            checked={exclusion.isExcluded}
            disabled={exclusion.isPending}
            onCheckedChange={(next) => exclusion.mutate({ isExcluded: next })}
          />
        </ItemActions>
      </Item>
      {exclusion.isExcluded ? (
        <ExclusionReasonField
          disabled={exclusion.isPending}
          key={account.id}
          onSave={(reason) => exclusion.mutate({ isExcluded: true, reason })}
          reason={exclusion.reason}
        />
      ) : null}
    </section>
  );
};
