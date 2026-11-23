import {
  Home,
  MessagesSparkle,
  Receipt,
  Repeat,
  Settings,
} from "kubai-icons-react";
import type { KubaiIconComponent } from "kubai-icons-react";

import { m } from "@/paraglide/messages.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import type { ChartColorVar } from "@/shared/lib/chart-colors";

interface NavItem {
  color: ChartColorVar;
  icon: KubaiIconComponent;
  label: () => string;
  routeId: string;
  to: string;
}

export type NavEntry = (typeof NAV_ITEMS)[number];

export const MAIN_NAV_ITEMS = [
  {
    color: CHART_COLOR_VARS.blue,
    icon: Home,
    label: m.nav_home,
    routeId: "/_auth/",
    to: "/",
  },
  {
    color: CHART_COLOR_VARS.pink,
    icon: MessagesSparkle,
    label: m.nav_ask,
    routeId: "/_auth/ask",
    to: "/ask",
  },
  {
    color: CHART_COLOR_VARS.green,
    icon: Receipt,
    label: m.nav_budget_transactions,
    routeId: "/_auth/budget/transactions",
    to: "/budget/transactions",
  },
  {
    color: CHART_COLOR_VARS.orange,
    icon: Repeat,
    label: m.nav_budget_recurring,
    routeId: "/_auth/budget/recurring",
    to: "/budget/recurring",
  },
] as const satisfies readonly NavItem[];

export const SETTINGS_NAV_ITEM = {
  color: CHART_COLOR_VARS.grey,
  icon: Settings,
  label: m.nav_settings,
  routeId: "/_auth/settings",
  to: "/settings",
} as const satisfies NavItem;

export const NAV_ITEMS = [
  ...MAIN_NAV_ITEMS,
  SETTINGS_NAV_ITEM,
] as const satisfies readonly NavItem[];

const ACCOUNT_ROUTE_ID = "/_auth/accounts/$accountId";

export const CONVERSATION_ROUTE_ID = "/_auth/ask/$conversationId";

export const DASHBOARD_ROUTE_ID = "/_auth/dashboards/$dashboardId";

const ASK_ROUTE_IDS = new Set([
  "/_auth/ask",
  "/_auth/ask/",
  CONVERSATION_ROUTE_ID,
]);

export const isFullWidthRoute = (routeId: string | undefined): boolean =>
  routeId !== undefined && ASK_ROUTE_IDS.has(routeId);

export const isCurrentNav = (pathname: string, to: string): boolean =>
  to === "/"
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`);

export const navTrailOf = (
  routeId: string | undefined,
  pageTitle: string | undefined
): string[] => {
  if (routeId === ACCOUNT_ROUTE_ID) {
    return [m.nav_home(), m.nav_bank_account()];
  }

  if (routeId === CONVERSATION_ROUTE_ID) {
    return [m.nav_ask(), pageTitle ?? m.ask_untitled_chat()];
  }

  if (routeId === DASHBOARD_ROUTE_ID) {
    return pageTitle === undefined
      ? [m.nav_dashboards()]
      : [m.nav_dashboards(), pageTitle];
  }

  const item = NAV_ITEMS.find(
    (entry) => entry.routeId === routeId || `${entry.routeId}/` === routeId
  );

  return [item ? item.label() : m.nav_home()];
};
