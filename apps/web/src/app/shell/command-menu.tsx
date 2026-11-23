import {
  CommandMenu,
  CommandMenuDialog,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
  CommandMenuTabs,
} from "@freenary/ui/components/command-menu";
import type { CommandMenuItemData } from "@freenary/ui/components/command-menu";
import { useNavigate } from "@tanstack/react-router";
import { Match } from "effect";
import { useCallback, useMemo, useState } from "react";

import { useStartChat } from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";

import { setCommandMenuOpen, useCommandMenuOpen } from "./command-menu-state";
import {
  COMMAND_MENU_TABS,
  useCommandMenuItems,
} from "./use-command-menu-items";
import type {
  CommandItem,
  CommandMenuTab,
  CommandTarget,
} from "./use-command-menu-items";

const IDLE_TABS = new Set<CommandItem["tab"]>(["pages", "dashboards", "chats"]);

const IDLE_ROWS_PER_GROUP = 5;

const TAB_LABELS = {
  accounts: m.command_menu_tab_accounts,
  all: m.command_menu_tab_all,
  categories: m.command_menu_tab_categories,
  chats: m.command_menu_tab_chats,
  dashboards: m.command_menu_tab_dashboards,
  pages: m.command_menu_tab_pages,
  recurring: m.command_menu_tab_recurring,
  transactions: m.command_menu_tab_transactions,
} satisfies Record<CommandMenuTab, () => string>;

const isCommandMenuTab = (value: string): value is CommandMenuTab =>
  COMMAND_MENU_TABS.some((tab) => tab === value);

const idleRows = (items: CommandItem[]): CommandItem[] => {
  const shown = new Map<string, number>();

  return items.filter((item) => {
    const count = shown.get(item.tab) ?? 0;

    if (!IDLE_TABS.has(item.tab) || count >= IDLE_ROWS_PER_GROUP) {
      return false;
    }

    shown.set(item.tab, count + 1);

    return true;
  });
};

const CommandRow = ({ item }: { item: CommandItem }) => (
  <CommandMenuItem className="h-auto min-h-9 py-1.5" value={item.value}>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{item.label}</span>
      {item.description ? (
        <span className="text-muted-foreground truncate text-xs">
          {item.description}
        </span>
      ) : null}
    </span>
    {item.amount ? (
      <span className="shrink-0 text-sm tabular-nums">{item.amount}</span>
    ) : null}
  </CommandMenuItem>
);

export const AppCommandMenu = () => {
  const open = useCommandMenuOpen();
  const navigate = useNavigate();
  const { startChat } = useStartChat();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<CommandMenuTab>("all");
  const { items } = useCommandMenuItems(query, open);

  const visible = useMemo(() => {
    if (tab !== "all") {
      return items.filter((item) => item.tab === tab);
    }

    return query.trim().length === 0 ? idleRows(items) : items;
  }, [items, query, tab]);

  const close = useCallback(() => {
    setCommandMenuOpen(false);
    setQuery("");
    setTab("all");
  }, []);

  const go = useCallback(
    (target: CommandTarget) =>
      Match.value(target).pipe(
        Match.discriminatorsExhaustive("kind")({
          account: ({ accountId }) =>
            navigate({ params: { accountId }, to: "/accounts/$accountId" }),
          ask: ({ question }) => startChat(question),
          category: ({ category }) =>
            navigate({
              search: {
                filters: [
                  { field: "category", operator: "is", values: [category] },
                ],
              },
              to: "/budget/transactions",
            }),
          chat: ({ conversationId }) =>
            navigate({
              params: { conversationId },
              to: "/ask/$conversationId",
            }),
          dashboard: ({ dashboardId }) =>
            navigate({
              params: { dashboardId },
              to: "/dashboards/$dashboardId",
            }),
          page: ({ to }) => navigate({ to }),
          recurring: ({ search }) =>
            navigate({ search: { rq: search }, to: "/budget/recurring" }),
          settings: ({ section }) =>
            navigate({ search: { section }, to: "/settings" }),
          transactions: ({ search }) =>
            navigate({ search: { q: search }, to: "/budget/transactions" }),
        })
      ),
    [navigate, startChat]
  );

  const select = useCallback(
    (picked: CommandMenuItemData) => {
      const item = items.find((candidate) => candidate.value === picked.value);

      if (item) {
        void go(item.target);
      }

      close();
    },
    [close, go, items]
  );

  const searched = query.trim();

  return (
    <CommandMenuDialog
      className="max-h-[min(560px,80dvh)] max-w-[680px]"
      description={m.command_menu_description()}
      onOpenChange={(next) => (next ? setCommandMenuOpen(true) : close())}
      open={open}
      title={m.command_menu_title()}
    >
      <CommandMenu
        filter={(item, typed) =>
          item.keywords?.includes(typed.trim()) === true ||
          `${item.label} ${item.description ?? ""}`
            .toLocaleLowerCase()
            .includes(typed.trim().toLocaleLowerCase())
        }
        items={visible}
        onQueryChange={setQuery}
        onSelect={select}
        query={query}
      >
        <CommandMenuInput
          aria-label={m.command_menu_title()}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              event.shiftKey &&
              searched.length > 0
            ) {
              event.preventDefault();
              void go({ kind: "transactions", search: searched });
              close();
            }
          }}
          placeholder={m.command_menu_placeholder()}
        />
        <CommandMenuTabs
          onValueChange={(next) => {
            if (isCommandMenuTab(next)) {
              setTab(next);
            }
          }}
          tabs={COMMAND_MENU_TABS.map((value) => ({
            label: TAB_LABELS[value](),
            value,
          }))}
          value={tab}
        />
        <CommandMenuList
          renderItem={(row) => {
            const item = visible.find(
              (candidate) => candidate.value === row.value
            );

            return item ? <CommandRow item={item} key={item.value} /> : null;
          }}
        >
          <CommandMenuEmpty>{m.command_menu_empty()}</CommandMenuEmpty>
        </CommandMenuList>
        <CommandMenuFooter
          hints={[
            { keys: "enter", label: m.command_menu_hint_open() },
            { keys: ["up", "down"], label: m.command_menu_hint_move() },
            { keys: ["left", "right"], label: m.command_menu_hint_filter() },
            ...(searched.length > 0
              ? [
                  {
                    keys: "shift+enter",
                    label: m.command_menu_hint_all_transactions(),
                  },
                ]
              : []),
          ]}
        />
      </CommandMenu>
    </CommandMenuDialog>
  );
};
