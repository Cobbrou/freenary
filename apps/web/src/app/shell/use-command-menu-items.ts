import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import {
  CATEGORY_GROUP_OF,
  SPENDING_CATEGORIES,
} from "@freenary/api/lib/taxonomy";
import type { CommandMenuItemData } from "@freenary/ui/components/command-menu";
import {
  RiBankLine,
  RiChat3Line,
  RiDashboardLine,
  RiRepeatLine,
  RiSettings3Line,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { MessagesSparkle } from "kubai-icons-react";
import { useMemo } from "react";

import { accountName, formatAccountBalances } from "@/entities/account";
import { transactionTitle } from "@/entities/budget";
import { categoryLabel, categoryMenuIcon } from "@/entities/category";
import { conversationsQueryOptions } from "@/entities/conversation";
import { dashboardsQueryOptions } from "@/entities/dashboard";
import { merchantLabel } from "@/entities/recurring";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { client, orpc } from "@/shared/api";
import { OPERATOR_SETTINGS_SECTIONS, SETTINGS_SECTIONS } from "@/shared/config";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { formatCurrency } from "@/shared/lib/format-currency";
import { kubaiIcon } from "@/shared/lib/kubai-icon";
import { remixIcon } from "@/shared/lib/remix-icon";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

import { NAV_ITEMS } from "./nav-items";

export const COMMAND_MENU_TABS = [
  "all",
  "transactions",
  "accounts",
  "categories",
  "recurring",
  "dashboards",
  "chats",
  "pages",
] as const;

export type CommandMenuTab = (typeof COMMAND_MENU_TABS)[number];

export type CommandTarget =
  | { kind: "account"; accountId: string }
  | { kind: "ask"; question: string }
  | { kind: "category"; category: (typeof SPENDING_CATEGORIES)[number] }
  | { kind: "chat"; conversationId: string }
  | { kind: "dashboard"; dashboardId: string }
  | { kind: "page"; to: string }
  | { kind: "recurring"; search: string }
  | { kind: "settings"; section: (typeof SETTINGS_SECTIONS)[number] }
  | { kind: "transactions"; search: string };

export interface CommandItem extends CommandMenuItemData {
  amount?: string;
  tab: Exclude<CommandMenuTab, "all"> | "ask";
  target: CommandTarget;
}

const SEARCH_DEBOUNCE_MS = 250;

const TRANSACTIONS_SHOWN = 5;

const EARLIEST_BANK_DATE = new Date(0);

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const AskIcon = kubaiIcon(MessagesSparkle, CHART_COLOR_VARS.pink);

const ACCOUNT_ICON = remixIcon(RiBankLine);

const CHAT_ICON = remixIcon(RiChat3Line);

const DASHBOARD_ICON = remixIcon(RiDashboardLine);

const RECURRING_ICON = remixIcon(RiRepeatLine);

const SETTINGS_ICON = remixIcon(RiSettings3Line);

const SETTINGS_SECTION_LABELS = {
  "api-keys": m.settings_tab_api_keys,
  appearance: m.settings_tab_appearance,
  "bank-accounts": m.settings_tab_bank_accounts,
  budget: m.settings_tab_budget,
  categories: m.settings_tab_categories,
  services: m.settings_tab_services,
  sessions: m.settings_tab_sessions,
  "sign-in": m.settings_tab_sign_in,
} satisfies Record<(typeof SETTINGS_SECTIONS)[number], () => string>;

const SPENDING_ONLY = SPENDING_CATEGORIES.filter(
  (category) => CATEGORY_GROUP_OF[category] === "spending"
);

export const useCommandMenuItems = (query: string, open: boolean) => {
  const search = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const searching = search.length > 0;

  const transactions = useQuery({
    enabled: open && searching,
    queryFn: () =>
      client.budget.getTransactions({
        from: EARLIEST_BANK_DATE,
        limit: TRANSACTIONS_SHOWN,
        search,
        sort: "date",
        to: new Date(),
      }),
    queryKey: ["command-menu", "transactions", search],
  });

  const overview = useQuery({
    ...orpc.portfolio.getOverview.queryOptions(),
    enabled: open,
  });

  const recurring = useQuery({
    ...orpc.budget.getRecurring.queryOptions(),
    enabled: open,
  });

  const dashboards = useQuery({ ...dashboardsQueryOptions(), enabled: open });

  const chats = useQuery({ ...conversationsQueryOptions(), enabled: open });

  const instanceStatus = useQuery({
    ...orpc.instance.status.queryOptions(),
    enabled: open,
  });

  const isOperator = instanceStatus.data?.isOperator === true;

  const items = useMemo((): CommandItem[] => {
    const locale = getLocale();
    const asked = query.trim();
    const transactionRows = searching
      ? (transactions.data?.transactions ?? [])
      : [];

    return [
      ...(asked.length > 0
        ? [
            {
              description: m.command_menu_ask_description(),
              group: m.command_menu_group_ask(),
              icon: AskIcon,
              keywords: [asked],
              label: m.command_menu_ask({ question: asked }),
              tab: "ask" as const,
              target: { kind: "ask" as const, question: asked },
              value: "ask",
            },
          ]
        : []),
      ...transactionRows.map((transaction) => ({
        amount: formatCurrency(transaction.amount, transaction.currency),
        description: [
          new Date(transaction.date).toLocaleDateString(locale, DAY_FORMAT),
          categoryLabel(transaction.category),
        ].join(" · "),
        group: m.command_menu_group_transactions(),
        icon: categoryMenuIcon(
          predefinedCategoryAppearance(transaction.category)
        ),
        keywords: [search],
        label: transactionTitle(transaction),
        tab: "transactions" as const,
        target: { kind: "transactions" as const, search },
        value: `transaction:${transaction.id}`,
      })),
      ...(transactionRows.length > 0
        ? [
            {
              group: m.command_menu_group_transactions(),
              keywords: [search],
              label: m.command_menu_all_transactions({ search }),
              shortcut: "shift+enter",
              tab: "transactions" as const,
              target: { kind: "transactions" as const, search },
              value: "transactions:all",
            },
          ]
        : []),
      ...(overview.data?.accounts ?? []).map((account) => ({
        amount:
          formatAccountBalances(account, overview.data?.currency ?? "EUR") ??
          undefined,
        description: account.institutionName ?? undefined,
        group: m.command_menu_group_accounts(),
        icon: ACCOUNT_ICON,
        label: accountName(account),
        tab: "accounts" as const,
        target: { accountId: account.id, kind: "account" as const },
        value: `account:${account.id}`,
      })),
      ...SPENDING_ONLY.map((category) => ({
        group: m.command_menu_group_categories(),
        icon: categoryMenuIcon(predefinedCategoryAppearance(category)),
        label: categoryLabel(category),
        tab: "categories" as const,
        target: { category, kind: "category" as const },
        value: `category:${category}`,
      })),
      ...(recurring.data?.items ?? []).map((item) => ({
        amount: formatCurrency(item.typicalAmountMinor, item.currency),
        description: categoryLabel(item.category),
        group: m.command_menu_group_recurring(),
        icon: RECURRING_ICON,
        label: merchantLabel(item),
        tab: "recurring" as const,
        target: { kind: "recurring" as const, search: merchantLabel(item) },
        value: `recurring:${item.merchantKey}`,
      })),
      ...(dashboards.data?.dashboards ?? []).map((dashboard) => ({
        group: m.command_menu_group_dashboards(),
        icon: DASHBOARD_ICON,
        label: dashboard.title,
        tab: "dashboards" as const,
        target: { dashboardId: dashboard.id, kind: "dashboard" as const },
        value: `dashboard:${dashboard.id}`,
      })),
      ...(chats.data?.conversations ?? []).map((chat) => ({
        group: m.command_menu_group_chats(),
        icon: CHAT_ICON,
        label: chat.title ?? m.ask_untitled_chat(),
        tab: "chats" as const,
        target: { conversationId: chat.id, kind: "chat" as const },
        value: `chat:${chat.id}`,
      })),
      ...NAV_ITEMS.map((item) => ({
        group: m.command_menu_group_pages(),
        icon: kubaiIcon(item.icon, item.color),
        label: item.label(),
        tab: "pages" as const,
        target: { kind: "page" as const, to: item.to },
        value: `page:${item.to}`,
      })),
      ...SETTINGS_SECTIONS.flatMap((section) =>
        OPERATOR_SETTINGS_SECTIONS.has(section) && !isOperator
          ? []
          : [
              {
                description: m.nav_settings(),
                group: m.command_menu_group_pages(),
                icon: SETTINGS_ICON,
                label: SETTINGS_SECTION_LABELS[section](),
                tab: "pages" as const,
                target: { kind: "settings" as const, section },
                value: `settings:${section}`,
              },
            ]
      ),
    ];
  }, [
    chats.data,
    dashboards.data,
    isOperator,
    overview.data,
    query,
    recurring.data,
    search,
    searching,
    transactions.data,
  ]);

  return { items, searching: transactions.isFetching };
};
