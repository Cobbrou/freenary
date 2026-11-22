import { useQuery } from "@tanstack/react-query";

import {
  BankLinkingCheckFailed,
  BankLinkingUnavailable,
  BankListSkeleton,
  ConnectedBankList,
  useBankLinking,
} from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { ConnectBankDialog } from "./connect-bank-dialog";
import { SettingsListSurface } from "./settings-list-surface";
import { SettingsSubgroup } from "./settings-subgroup";

export const BankAccountsSection = () => {
  const bankLinking = useBankLinking();

  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      enabled: bankLinking === "available",
    })
  );

  const renderList = () => {
    if (bankLinking === "pending") {
      return (
        <div aria-busy="true">
          <output className="sr-only">
            {m.settings_bank_accounts_loading()}
          </output>
          <div aria-hidden="true">
            <BankListSkeleton rows={2} />
          </div>
        </div>
      );
    }

    if (bankLinking === "check-failed") {
      return <BankLinkingCheckFailed />;
    }

    if (bankLinking === "unavailable") {
      return <BankLinkingUnavailable />;
    }

    return <ConnectedBankList banks={banksQuery.data?.banks ?? []} />;
  };

  return (
    <SettingsSubgroup
      action={bankLinking === "available" ? <ConnectBankDialog /> : null}
      description={m.settings_bank_accounts_description()}
      title={m.settings_bank_accounts_title()}
    >
      <SettingsListSurface>{renderList()}</SettingsListSurface>
    </SettingsSubgroup>
  );
};
