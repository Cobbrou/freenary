import { Skeleton } from "@freenary/ui/components/skeleton";

import { BudgetMonthField } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";

import { useBudgetMonthSetting } from "../model/use-budget-month-setting";
import { SettingsSection } from "./settings-section";

const FIELD_SKELETON = "h-8 w-80";

export const BudgetMonthSection = () => {
  const { isSaving, loadError, save, setting } = useBudgetMonthSetting();

  const renderField = () => {
    if (setting !== undefined) {
      return (
        <BudgetMonthField disabled={isSaving} onChange={save} value={setting} />
      );
    }

    return loadError ? null : <Skeleton className={FIELD_SKELETON} />;
  };

  return (
    <SettingsSection
      description={m.settings_budget_month_description()}
      title={m.settings_budget_month_title()}
    >
      {renderField()}
    </SettingsSection>
  );
};
