import {
  RiBankLine,
  RiMoneyDollarCircleLine,
  RiPaletteLine,
  RiPlugLine,
  RiShieldKeyholeLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import { DEFAULT_SETTINGS_SECTION } from "@/shared/config";
import type { SettingsSection } from "@/shared/config";

export type OperatorStanding = "member" | "operator" | "pending";

interface SettingsNavItem {
  icon: RemixiconComponentType;
  label: () => string;
  operatorOnly: boolean;
  section: SettingsSection;
}

export const SETTINGS_NAV_ITEMS = [
  {
    icon: RiPaletteLine,
    label: m.settings_group_appearance_title,
    operatorOnly: false,
    section: "appearance",
  },
  {
    icon: RiBankLine,
    label: m.settings_group_connections_title,
    operatorOnly: false,
    section: "connections",
  },
  {
    icon: RiMoneyDollarCircleLine,
    label: m.settings_group_budget_title,
    operatorOnly: false,
    section: "budget",
  },
  {
    icon: RiShieldKeyholeLine,
    label: m.settings_group_security_title,
    operatorOnly: false,
    section: "security",
  },
  {
    icon: RiPlugLine,
    label: m.settings_group_integrations_title,
    operatorOnly: true,
    section: "integrations",
  },
] as const satisfies readonly SettingsNavItem[];

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

const isOperatorOnly = (section: SettingsSection): boolean =>
  SETTINGS_NAV_ITEMS.some(
    (item) => item.section === section && item.operatorOnly
  );

export const settingsNavItemsFor = (
  standing: OperatorStanding
): SettingsNavItem[] =>
  SETTINGS_NAV_ITEMS.filter(
    (item) => standing === "operator" || !item.operatorOnly
  );

export const shownSettingsSection = (
  requested: SettingsSection,
  standing: OperatorStanding
): SettingsSection | null => {
  if (!isOperatorOnly(requested) || standing === "operator") {
    return requested;
  }

  return standing === "pending" ? null : DEFAULT_SETTINGS_SECTION;
};
