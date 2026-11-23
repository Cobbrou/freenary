import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useMemo } from "react";

import { conversationsQueryOptions } from "@/entities/conversation";
import { dashboardsQueryOptions } from "@/entities/dashboard";
import { m } from "@/paraglide/messages.js";
import { startOfDay, useNow } from "@/shared/lib/calendar-day";

import { ChatList } from "./chat-list";

export const AskArea = () => {
  const now = useNow();
  const today = useMemo(() => startOfDay(now), [now]);
  const chats = useQuery(conversationsQueryOptions());
  const dashboards = useQuery(dashboardsQueryOptions());

  return (
    <div className="flex h-[calc(100svh-4rem-var(--update-banner-height,0px)-var(--bottom-tab-bar-height)-1rem)] min-h-0 md:h-[calc(100svh-4rem-var(--update-banner-height,0px))]">
      <nav
        aria-label={m.ask_history_label()}
        className="hidden w-64 shrink-0 flex-col border-e px-3 pb-4 md:flex"
      >
        <ChatList
          chats={chats.data?.conversations}
          dashboards={dashboards.data?.dashboards}
          today={today}
        />
      </nav>
      <div className="flex min-w-0 flex-1 flex-col px-4 pb-4">
        <Outlet />
      </div>
    </div>
  );
};
