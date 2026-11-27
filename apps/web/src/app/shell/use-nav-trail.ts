import { useQuery } from "@tanstack/react-query";
import { useMatches } from "@tanstack/react-router";

import { accountName } from "@/entities/account";
import { conversationsQueryOptions } from "@/entities/conversation";
import { dashboardsQueryOptions } from "@/entities/dashboard";
import { orpc } from "@/shared/api";

import {
  ACCOUNT_SETTINGS_ROUTE_ID,
  CONVERSATION_ROUTE_ID,
  DASHBOARD_ROUTE_ID,
  navTrailOf,
} from "./nav-items";

export const useNavTrail = () => {
  const match = useMatches({ select: (matches) => matches.at(-1) });
  const routeId = match?.routeId;
  const params: Partial<Record<string, string>> = match?.params ?? {};

  const conversationTitle = useQuery({
    ...conversationsQueryOptions(),
    enabled: routeId === CONVERSATION_ROUTE_ID,
    select: ({ conversations }) =>
      conversations.find((chat) => chat.id === params.conversationId)?.title ??
      undefined,
  });

  const dashboardTitle = useQuery({
    ...dashboardsQueryOptions(),
    enabled: routeId === DASHBOARD_ROUTE_ID,
    select: ({ dashboards }) =>
      dashboards.find((dashboard) => dashboard.id === params.dashboardId)
        ?.title,
  });

  const accountTitle = useQuery({
    ...orpc.portfolio.getOverview.queryOptions(),
    enabled: routeId === ACCOUNT_SETTINGS_ROUTE_ID,
    select: ({ accounts }) => {
      const account = accounts.find((item) => item.id === params.accountId);

      return account ? accountName(account) : undefined;
    },
  });

  return {
    routeId,
    trail: navTrailOf(
      routeId,
      conversationTitle.data ?? dashboardTitle.data ?? accountTitle.data
    ),
  };
};
