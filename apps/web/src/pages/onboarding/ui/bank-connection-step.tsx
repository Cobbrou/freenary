import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";

import {
  BankConnectionPanel,
  BankLinkingCheckFailed,
  BankLinkingUnavailable,
} from "@/features/bank-connection";
import type { BankInstitution, BankLinking } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

interface BankConnectionStepProps {
  bankLinking: BankLinking;
  banks: BankInstitution[];
  connectedCount: number;
  isBanksError: boolean;
  isBanksPending: boolean;
  isCompleting: boolean;
  onBack: () => void;
  onFinish: () => void;
  unavailableCountries: string[];
}

export const BankConnectionStep = ({
  bankLinking,
  banks,
  connectedCount,
  isBanksError,
  isBanksPending,
  isCompleting,
  onBack,
  onFinish,
  unavailableCountries,
}: BankConnectionStepProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const hasConnectedBank = connectedCount > 0;

  const renderBankLinking = () => {
    if (bankLinking === "check-failed") {
      return <BankLinkingCheckFailed />;
    }

    if (bankLinking === "unavailable") {
      return (
        <BankLinkingUnavailable>
          <p className="text-muted-foreground text-sm">
            {m.onboarding_bank_unavailable_ask_operator()}
          </p>
        </BankLinkingUnavailable>
      );
    }

    return (
      <BankConnectionPanel
        banks={banks}
        isBanksError={isBanksError}
        isBanksPending={isBanksPending}
        returnTo="onboarding"
        unavailableCountries={unavailableCountries}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={m.onboarding_bank_description()}
        title={m.onboarding_bank_title()}
      />
      {renderBankLinking()}
      <div className="flex items-center justify-between gap-3">
        <Button
          leadingIcon={ArrowLeftIcon}
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          {m.onboarding_back()}
        </Button>
        <Button
          disabled={!hasConnectedBank}
          loading={isCompleting}
          onClick={onFinish}
          type="button"
        >
          {hasConnectedBank
            ? m.onboarding_finish_with_count({ count: connectedCount })
            : m.onboarding_finish()}
        </Button>
      </div>
    </div>
  );
};
