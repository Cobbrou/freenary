import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";

import { BankConnectionPanel } from "@/features/bank-connection";
import type { BankInstitution } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

interface BankConnectionStepProps {
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

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={m.onboarding_bank_description()}
        title={m.onboarding_bank_title()}
      />
      <BankConnectionPanel
        banks={banks}
        isBanksError={isBanksError}
        isBanksPending={isBanksPending}
        returnTo="onboarding"
        unavailableCountries={unavailableCountries}
      />
      <div className="flex items-center justify-between gap-3">
        <Button
          leadingIcon={ArrowLeftIcon}
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          {m.onboarding_back()}
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={onFinish} type="button" variant="secondary">
            {m.onboarding_skip()}
          </Button>
          <Button loading={isCompleting} onClick={onFinish} type="button">
            {connectedCount > 0
              ? m.onboarding_finish_with_count({ count: connectedCount })
              : m.onboarding_finish()}
          </Button>
        </div>
      </div>
    </div>
  );
};
