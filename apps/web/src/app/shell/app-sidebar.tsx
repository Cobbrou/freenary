import { CommandMenuShortcut } from "@freenary/ui/components/command-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@freenary/ui/components/sidebar";
import { RiSearchLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, LayoutDashboardPlus } from "kubai-icons-react";
import { useRef } from "react";

import {
  dashboardsQueryOptions,
  useDashboardUpdates,
} from "@/entities/dashboard";
import { m } from "@/paraglide/messages.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { kubaiIcon } from "@/shared/lib/kubai-icon";
import { AiUpdateScope } from "@/shared/ui/ai-update-scope";
import type { AiUpdateScopeHandle } from "@/shared/ui/ai-update-scope";

import { setCommandMenuOpen } from "./command-menu-state";
import { isCurrentNav, MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM } from "./nav-items";
import type { NavEntry } from "./nav-items";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarFirstSteps } from "./sidebar-first-steps";
import { SidebarNotifications } from "./sidebar-notifications";
import { SidebarUserMenu } from "./sidebar-user-menu";

const DASHBOARD_SKELETON_ROWS = 3;

const DashboardIcon = kubaiIcon(LayoutDashboard, CHART_COLOR_VARS.grey);

const NewDashboardIcon = kubaiIcon(LayoutDashboardPlus, CHART_COLOR_VARS.pink);

const NavRow = ({ item, pathname }: { item: NavEntry; pathname: string }) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      icon={kubaiIcon(item.icon, item.color)}
      isActive={isCurrentNav(pathname, item.to)}
      render={<Link to={item.to} />}
    >
      {item.label()}
    </SidebarMenuButton>
  </SidebarMenuItem>
);

const SearchTrigger = () => (
  <button
    className="border-input bg-background text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 flex h-8 w-full items-center gap-2 rounded-md border ps-2.5 pe-1.5 text-sm outline-none focus-visible:ring-[3px]"
    onClick={() => setCommandMenuOpen(true)}
    type="button"
  >
    <RiSearchLine aria-hidden="true" className="size-4 shrink-0" />
    <span className="min-w-0 flex-1 truncate text-start">
      {m.command_menu_trigger()}
    </span>
    <CommandMenuShortcut keys="mod+k" />
  </button>
);

const DashboardsGroup = ({ pathname }: { pathname: string }) => {
  const dashboards = useQuery(dashboardsQueryOptions());
  const updateScope = useRef<AiUpdateScopeHandle>(null);

  useDashboardUpdates(({ refresh }) => {
    updateScope.current?.play({ change: refresh });
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground">
        {m.nav_dashboards()}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <AiUpdateScope ref={updateScope} size="element">
          <SidebarMenu>
            {dashboards.isPending &&
              Array.from({ length: DASHBOARD_SKELETON_ROWS }, (_, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            {dashboards.data?.dashboards.map((dashboard) => (
              <SidebarMenuItem key={dashboard.id}>
                <SidebarMenuButton
                  icon={DashboardIcon}
                  isActive={pathname === `/dashboards/${dashboard.id}`}
                  render={
                    <Link
                      params={{ dashboardId: dashboard.id }}
                      title={dashboard.title}
                      to="/dashboards/$dashboardId"
                    />
                  }
                >
                  {dashboard.title}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                icon={NewDashboardIcon}
                render={
                  <Link
                    search={{ draft: m.dashboards_new_prompt() }}
                    to="/ask"
                  />
                }
              >
                {m.nav_new_dashboard()}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </AiUpdateScope>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const RAIL_BELOW_THE_BANNER =
  "top-[var(--update-banner-height,0px)] h-[calc(100svh-var(--update-banner-height,0px))]";

export const AppSidebar = () => {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Sidebar
      className={RAIL_BELOW_THE_BANNER}
      collapsible="offcanvas"
      variant="floating"
    >
      <SidebarHeader className="gap-2">
        <SidebarBrand />
        <SearchTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV_ITEMS.map((item) => (
                <NavRow item={item} key={item.to} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <DashboardsGroup pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarFirstSteps />
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarNotifications />
          <NavRow item={SETTINGS_NAV_ITEM} pathname={pathname} />
        </SidebarMenu>
        <SidebarUserMenu />
      </SidebarFooter>
    </Sidebar>
  );
};
