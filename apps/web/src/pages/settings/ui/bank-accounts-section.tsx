import { useQuery } from "@tanstack/react-query";

import {
  BankConnectionPanel,
  BankLinkingCheckFailed,
  BankLinkingUnavailable,
  BankListSkeleton,
  useBankLinking,
} from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { SettingsSection } from "./settings-section";

const INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS = {};

export const BankAccountsSection = () => {
  const bankLinking = useBankLinking();

  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      enabled: bankLinking === "available",
      input: INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS,
    })
  );

  const renderPanel = () => {
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

    return (
      <BankConnectionPanel
        banks={banksQuery.data?.banks ?? []}
        isBanksError={banksQuery.isError}
        isBanksPending={banksQuery.isPending}
        returnTo="settings"
        unavailableCountries={banksQuery.data?.unavailableCountries ?? []}
      />
    );
  };

  return (
    <SettingsSection
      description={m.settings_bank_accounts_description()}
      title={m.settings_bank_accounts_title()}
    >
      {renderPanel()}
    </SettingsSection>
  );
};
