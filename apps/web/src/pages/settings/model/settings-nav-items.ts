import {
  CurrencyDollar,
  KeyRound,
  Landmark,
  Laptop,
  Palette,
  ServerCog,
  ShieldLock,
  Tags,
} from "kubai-icons-react";
import type { KubaiIconComponent } from "kubai-icons-react";

import { m } from "@/paraglide/messages.js";
import { OPERATOR_SETTINGS_SECTIONS } from "@/shared/config";
import type { SettingsSection } from "@/shared/config";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import type { ChartColorVar } from "@/shared/lib/chart-colors";

export type OperatorStanding = "member" | "operator" | "pending";

interface SettingsNavItem {
  color: ChartColorVar;
  icon: KubaiIconComponent;
  label: () => string;
  section: SettingsSection;
}

interface SettingsNavCategory {
  id: string;
  items: readonly SettingsNavItem[];
  label: () => string;
}

export const SETTINGS_NAV_CATEGORIES = [
  {
    id: "preferences",
    items: [
      {
        color: CHART_COLOR_VARS.pink,
        icon: Palette,
        label: m.settings_tab_appearance,
        section: "appearance",
      },
    ],
    label: m.settings_nav_group_preferences,
  },
  {
    id: "finances",
    items: [
      {
        color: CHART_COLOR_VARS.blue,
        icon: Landmark,
        label: m.settings_tab_bank_accounts,
        section: "bank-accounts",
      },
      {
        color: CHART_COLOR_VARS.green,
        icon: CurrencyDollar,
        label: m.settings_tab_budget,
        section: "budget",
      },
      {
        color: CHART_COLOR_VARS.orange,
        icon: Tags,
        label: m.settings_tab_categories,
        section: "categories",
      },
    ],
    label: m.settings_nav_group_finances,
  },
  {
    id: "security",
    items: [
      {
        color: CHART_COLOR_VARS.purple,
        icon: ShieldLock,
        label: m.settings_tab_sign_in,
        section: "sign-in",
      },
      {
        color: CHART_COLOR_VARS.purple,
        icon: Laptop,
        label: m.settings_tab_sessions,
        section: "sessions",
      },
      {
        color: CHART_COLOR_VARS.purple,
        icon: KeyRound,
        label: m.settings_tab_api_keys,
        section: "api-keys",
      },
    ],
    label: m.settings_nav_group_security,
  },
  {
    id: "instance",
    items: [
      {
        color: CHART_COLOR_VARS.grey,
        icon: ServerCog,
        label: m.settings_tab_services,
        section: "services",
      },
    ],
    label: m.settings_nav_group_instance,
  },
] as const satisfies readonly SettingsNavCategory[];

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] =
  SETTINGS_NAV_CATEGORIES.flatMap(
    (category): readonly SettingsNavItem[] => category.items
  );

interface OperatorStatus {
  isOperator: boolean | undefined;
  isPending: boolean;
}

export const operatorStandingOf = ({
  isOperator,
  isPending,
}: OperatorStatus): OperatorStanding => {
  if (isPending) {
    return "pending";
  }

  return isOperator === true ? "operator" : "member";
};

export const showsServices = (standing: OperatorStanding): boolean =>
  standing === "operator";

export const isSectionShownTo = (
  section: SettingsSection,
  standing: OperatorStanding
): boolean =>
  !OPERATOR_SETTINGS_SECTIONS.has(section) || showsServices(standing);

export const settingsNavCategoriesFor = (
  standing: OperatorStanding
): readonly SettingsNavCategory[] =>
  SETTINGS_NAV_CATEGORIES.flatMap((category) => {
    const items = category.items.filter((item) =>
      isSectionShownTo(item.section, standing)
    );

    return items.length > 0 ? [{ ...category, items }] : [];
  });

export const settingsNavItemOf = (
  section: SettingsSection
): SettingsNavItem | undefined =>
  SETTINGS_NAV_ITEMS.find((item) => item.section === section);
