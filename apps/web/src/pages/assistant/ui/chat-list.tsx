import { Button } from "@freenary/ui/components/button";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { Tabs, TabsItem, TabsPanel } from "@freenary/ui/components/tabs";
import { cn } from "@freenary/ui/lib/utils";
import { RiAddLine, RiChat3Line, RiDashboardLine } from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { Link, useLocation } from "@tanstack/react-router";
import { useId, useState } from "react";

import type { DashboardSummary } from "@/entities/dashboard";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { recentDateLabel } from "@/shared/lib/calendar-day";
import { remixIcon } from "@/shared/lib/remix-icon";

export interface ChatSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}

interface ChatListProps {
  chats: ChatSummary[] | undefined;
  dashboards: DashboardSummary[] | undefined;
  today: Date;
}

interface ListRowProps {
  current: boolean;
  date: Date;
  icon: RemixiconComponentType;
  title: string;
  today: Date;
}

const LIST_TABS = ["chats", "dashboards"] as const;

const SKELETON_ROWS = 5;

const AddIcon = remixIcon(RiAddLine);

const rowClass =
  "hover:bg-accent focus-visible:ring-ring/50 flex h-9 items-center gap-2.5 rounded-md px-2 text-sm outline-none focus-visible:ring-[3px]";

const RowContent = ({
  date,
  icon: Icon,
  title,
  today,
}: Omit<ListRowProps, "current">) => (
  <>
    <Icon
      aria-hidden="true"
      className="text-muted-foreground size-4 shrink-0"
    />
    <span className="min-w-0 flex-1 truncate">{title}</span>
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
      {recentDateLabel(date, today, getLocale())}
    </span>
  </>
);

const ListSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-1 px-2 py-1">
    <output className="sr-only">{label}</output>
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton className="h-5" key={index} />
      ))}
    </div>
  </div>
);

const EmptyList = ({ children }: { children: string }) => (
  <p className="text-muted-foreground px-2 py-1 text-sm text-pretty">
    {children}
  </p>
);

export const ChatList = ({ chats, dashboards, today }: ChatListProps) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const tabsId = useId();
  const [selectedIndex, setSelectedIndex] = useState(
    pathname.startsWith("/dashboards") ? 1 : 0
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Button
        className="w-full justify-start"
        leadingIcon={AddIcon}
        render={<Link to="/ask" />}
        variant="secondary"
      >
        {m.ask_new_chat()}
      </Button>
      <Tabs
        idPrefix={tabsId}
        onSelect={setSelectedIndex}
        selectedIndex={selectedIndex}
      >
        {LIST_TABS.map((tab, index) => (
          <TabsItem
            index={index}
            key={tab}
            label={tab === "chats" ? m.ask_tab_chats() : m.ask_tab_dashboards()}
          />
        ))}
      </Tabs>
      <TabsPanel
        className="min-h-0 flex-1 overflow-y-auto"
        idPrefix={tabsId}
        index={0}
        selectedIndex={selectedIndex}
      >
        {chats === undefined && <ListSkeleton label={m.ask_chats_loading()} />}
        {chats?.length === 0 && <EmptyList>{m.ask_chats_empty()}</EmptyList>}
        <ul className="flex flex-col gap-0.5">
          {chats?.map((chat) => {
            const current = pathname === `/ask/${chat.id}`;

            return (
              <li key={chat.id}>
                <Link
                  aria-current={current ? "page" : undefined}
                  className={cn(rowClass, current && "bg-accent")}
                  params={{ conversationId: chat.id }}
                  title={chat.title ?? undefined}
                  to="/ask/$conversationId"
                >
                  <RowContent
                    date={new Date(chat.updatedAt)}
                    icon={RiChat3Line}
                    title={chat.title ?? m.ask_untitled_chat()}
                    today={today}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </TabsPanel>
      <TabsPanel
        className="min-h-0 flex-1 overflow-y-auto"
        idPrefix={tabsId}
        index={1}
        selectedIndex={selectedIndex}
      >
        {dashboards === undefined && (
          <ListSkeleton label={m.dashboards_loading()} />
        )}
        {dashboards?.length === 0 && (
          <EmptyList>{m.ask_dashboards_empty()}</EmptyList>
        )}
        <ul className="flex flex-col gap-0.5">
          {dashboards?.map((dashboard) => (
            <li key={dashboard.id}>
              <Link
                className={rowClass}
                params={{ dashboardId: dashboard.id }}
                title={dashboard.title}
                to="/dashboards/$dashboardId"
              >
                <RowContent
                  date={new Date(dashboard.updatedAt)}
                  icon={RiDashboardLine}
                  title={dashboard.title}
                  today={today}
                />
              </Link>
            </li>
          ))}
        </ul>
      </TabsPanel>
    </div>
  );
};
