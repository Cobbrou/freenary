import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiErrorWarningLine, RiPlugLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";

import {
  BankConnectionPanel,
  BankListSkeleton,
} from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { SettingsSection } from "./settings-section";

const INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS = {};

export const BankAccountsSection = () => {
  const availability = useQuery(
    orpc.bankConnection.getProviderAvailability.queryOptions()
  );

  const isAvailable = availability.data?.available ?? false;

  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      enabled: isAvailable,
      input: INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS,
    })
  );

  const checkFailedWithNoAnswerYet =
    availability.isError && availability.data === undefined;

  const renderPanel = () => {
    if (availability.isPending) {
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

    if (checkFailedWithNoAnswerYet) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiErrorWarningLine />
            </EmptyMedia>
            <EmptyTitle>{m.settings_bank_check_error_title()}</EmptyTitle>
            <EmptyDescription>
              {m.settings_bank_check_error_description()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (!isAvailable) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiPlugLine />
            </EmptyMedia>
            <EmptyTitle>{m.settings_bank_unavailable_title()}</EmptyTitle>
            <EmptyDescription>
              {m.settings_bank_unavailable_description()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
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
