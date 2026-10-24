import {
  RiLinksLine,
  RiMoneyDollarCircleLine,
  RiPaletteLine,
  RiShieldKeyholeLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import type { SettingsSection } from "@/shared/config";

export type OperatorStanding = "member" | "operator" | "pending";

interface SettingsNavItem {
  icon: RemixiconComponentType;
  label: () => string;
  section: SettingsSection;
}

export const SETTINGS_NAV_ITEMS = [
  {
    icon: RiPaletteLine,
    label: m.settings_group_appearance_title,
    section: "appearance",
  },
  {
    icon: RiLinksLine,
    label: m.settings_group_connections_title,
    section: "connections",
  },
  {
    icon: RiMoneyDollarCircleLine,
    label: m.settings_group_budget_title,
    section: "budget",
  },
  {
    icon: RiShieldKeyholeLine,
    label: m.settings_group_security_title,
    section: "security",
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

export const showsServices = (standing: OperatorStanding): boolean =>
  standing === "operator";
