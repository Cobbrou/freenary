import { Button } from "@freenary/ui/components/button";

import type { BankInstitution, BankLinking } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { WizardShell } from "@/shared/ui/wizard-shell";
import { WizardStepper } from "@/shared/ui/wizard-stepper";

import { BankConnectionStep } from "./bank-connection-step";
import { CountrySelectionStep } from "./country-selection-step";
import { OnboardingWizardSkeleton } from "./onboarding-wizard-skeleton";

interface OnboardingWizardProps {
  bankLinking: BankLinking;
  banks: BankInstitution[];
  connectedCount: number;
  direction: 1 | -1;
  isBanksError: boolean;
  isBanksPending: boolean;
  isCompleting: boolean;
  isOperator: boolean;
  isPending: boolean;
  onBack: () => void;
  onCountriesChange: (countries: string[]) => void;
  onCountryContinue: () => void;
  onFinish: () => void;
  onSignOut: () => void;
  step: number;
  taxCountries: string[];
  unavailableCountries: string[];
}

const STEP_LABEL_FNS = [
  m.onboarding_step_country,
  m.onboarding_step_bank,
] as const satisfies readonly (() => string)[];

export const OnboardingWizard = ({
  bankLinking,
  banks,
  connectedCount,
  direction,
  isBanksError,
  isBanksPending,
  isCompleting,
  isOperator,
  isPending,
  onBack,
  onCountriesChange,
  onCountryContinue,
  onFinish,
  onSignOut,
  step,
  taxCountries,
  unavailableCountries,
}: OnboardingWizardProps) => (
  <WizardShell
    direction={direction}
    isPending={isPending}
    skeleton={<OnboardingWizardSkeleton />}
    stepKey={String(step)}
    stepper={
      <WizardStepper
        current={step}
        label={m.onboarding_progress_label()}
        steps={STEP_LABEL_FNS}
      />
    }
    toolbar={
      <Button onClick={onSignOut} type="button" variant="ghost">
        {m.account_sign_out()}
      </Button>
    }
  >
    {step === 0 ? (
      <CountrySelectionStep
        onContinue={onCountryContinue}
        onCountriesChange={onCountriesChange}
        selected={taxCountries}
      />
    ) : (
      <BankConnectionStep
        bankLinking={bankLinking}
        banks={banks}
        connectedCount={connectedCount}
        isBanksError={isBanksError}
        isBanksPending={isBanksPending}
        isCompleting={isCompleting}
        isOperator={isOperator}
        onBack={onBack}
        onFinish={onFinish}
        unavailableCountries={unavailableCountries}
      />
    )}
  </WizardShell>
);
