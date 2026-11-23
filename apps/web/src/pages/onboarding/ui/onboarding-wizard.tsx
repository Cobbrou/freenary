import type { BudgetMonthSetting } from "@freenary/api/lib/budget-month";
import { Button } from "@freenary/ui/components/button";

import type { BankInstitution, BankLinking } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { WizardShell, WizardStepper } from "@/shared/ui/wizard";

import { onboardingAvatarState } from "../model/avatar-state";
import { ONBOARDING_STEPS } from "../model/steps";
import { BankConnectionStep } from "./bank-connection-step";
import { BudgetMonthStep } from "./budget-month-step";
import { CountrySelectionStep } from "./country-selection-step";
import { OnboardingWizardSkeleton } from "./onboarding-wizard-skeleton";

interface OnboardingWizardProps {
  bankLinking: BankLinking;
  banks: BankInstitution[];
  budgetMonth: BudgetMonthSetting;
  connectedCount: number;
  direction: 1 | -1;
  isBanksError: boolean;
  isBanksPending: boolean;
  isCompleting: boolean;
  isPending: boolean;
  onBack: () => void;
  onBudgetMonthChange: (setting: BudgetMonthSetting) => void;
  onBudgetMonthContinue: () => void;
  onCountriesChange: (countries: string[]) => void;
  onCountryContinue: () => void;
  onFinish: () => void;
  onSignOut: () => void;
  step: number;
  taxCountries: string[];
}

const STEP_LABEL_FNS = [
  m.onboarding_step_country,
  m.onboarding_step_budget_month,
  m.onboarding_step_bank,
] as const satisfies readonly (() => string)[];

export const OnboardingWizard = ({
  bankLinking,
  banks,
  budgetMonth,
  connectedCount,
  direction,
  isBanksError,
  isBanksPending,
  isCompleting,
  isPending,
  onBack,
  onBudgetMonthChange,
  onBudgetMonthContinue,
  onCountriesChange,
  onCountryContinue,
  onFinish,
  onSignOut,
  step,
  taxCountries,
}: OnboardingWizardProps) => {
  const renderStep = () => {
    if (step === ONBOARDING_STEPS.country) {
      return (
        <CountrySelectionStep
          onContinue={onCountryContinue}
          onCountriesChange={onCountriesChange}
          selected={taxCountries}
        />
      );
    }

    if (step === ONBOARDING_STEPS.budgetMonth) {
      return (
        <BudgetMonthStep
          onBack={onBack}
          onContinue={onBudgetMonthContinue}
          onChange={onBudgetMonthChange}
          value={budgetMonth}
        />
      );
    }

    return (
      <BankConnectionStep
        bankLinking={bankLinking}
        banks={banks}
        connectedCount={connectedCount}
        isBanksError={isBanksError}
        isBanksPending={isBanksPending}
        isCompleting={isCompleting}
        onBack={onBack}
        onFinish={onFinish}
      />
    );
  };

  return (
    <WizardShell
      avatarState={onboardingAvatarState({
        connectedCount,
        isCompleting,
        step,
      })}
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
      {renderStep()}
    </WizardShell>
  );
};
