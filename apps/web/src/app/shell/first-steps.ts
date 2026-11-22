import { CurrencyDollar, Link, ShieldLock } from "kubai-icons-react";
import type { KubaiIconComponent } from "kubai-icons-react";

import { m } from "@/paraglide/messages.js";
import type { SettingsSection } from "@/shared/config";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import type { ChartColorVar } from "@/shared/lib/chart-colors";

export interface FirstStepsState {
  hasAccountProtection: boolean;
  hasBankConnection: boolean;
  hasBudgetLine: boolean;
}

interface FirstStep {
  color: ChartColorVar;
  icon: KubaiIconComponent;
  id: string;
  isDone: (state: FirstStepsState) => boolean;
  label: () => string;
  section: SettingsSection;
  to: string;
}

export const FIRST_STEPS = [
  {
    color: CHART_COLOR_VARS.blue,
    icon: Link,
    id: "bank-connection",
    isDone: (state) => state.hasBankConnection,
    label: m.first_steps_connect_bank,
    section: "bank-accounts",
    to: "/settings",
  },
  {
    color: CHART_COLOR_VARS.green,
    icon: CurrencyDollar,
    id: "budgeting-profile",
    isDone: (state) => state.hasBudgetLine,
    label: m.first_steps_budgeting_profile,
    section: "budget",
    to: "/settings",
  },
  {
    color: CHART_COLOR_VARS.purple,
    icon: ShieldLock,
    id: "account-protection",
    isDone: (state) => state.hasAccountProtection,
    label: m.first_steps_protect_account,
    section: "sign-in",
    to: "/settings",
  },
] as const satisfies readonly FirstStep[];
