import type { BudgetMonthSetting } from "@freenary/api/lib/budget-month";
import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { RiArrowRightLine } from "@remixicon/react";

import { BudgetMonthField } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";
import { WizardStepHeader } from "@/shared/ui/wizard";

interface BudgetMonthStepProps {
  onBack: () => void;
  onChange: (setting: BudgetMonthSetting) => void;
  onContinue: () => void;
  value: BudgetMonthSetting;
}

export const BudgetMonthStep = ({
  onBack,
  onChange,
  onContinue,
  value,
}: BudgetMonthStepProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={m.onboarding_budget_month_description()}
        title={m.onboarding_budget_month_title()}
      />
      <BudgetMonthField onChange={onChange} value={value} />
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
          onClick={onContinue}
          trailingIcon={remixIcon(RiArrowRightLine)}
          type="button"
        >
          {m.onboarding_continue()}
        </Button>
      </div>
    </div>
  );
};
