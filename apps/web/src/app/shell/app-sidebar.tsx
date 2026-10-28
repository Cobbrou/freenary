import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@freenary/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@freenary/ui/components/sidebar";
import { spring } from "@freenary/ui/lib/springs";
import { RiArrowRightSLine } from "@remixicon/react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import { isNavArea, NAV_ITEMS } from "./nav-items";
import type { NavAreaEntry } from "./nav-items";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarFirstSteps } from "./sidebar-first-steps";
import { SidebarUserMenu } from "./sidebar-user-menu";

type NavEntry = (typeof NAV_ITEMS)[number];

const PLANNED_DIMMED_CLASS =
  "text-sidebar-foreground/40 hover:text-sidebar-foreground/50";

const CHEVRON_CLASS = "text-sidebar-foreground/50 ml-auto flex shrink-0";

const SUB_LIST_VARIANTS = {
  closed: {},
  open: { transition: { staggerChildren: 0.06 } },
} as const;

const SUB_ROW_VARIANTS = {
  closed: { opacity: 0, transition: spring.moderate.exit, y: -4 },
  open: { opacity: 1, transition: spring.moderate, y: 0 },
} as const;

const MotionSidebarMenuSubItem = motion.create(SidebarMenuSubItem);

const isCurrent = (pathname: string, to: string) =>
  to === "/"
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`);

const NavRow = ({ item, pathname }: { item: NavEntry; pathname: string }) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      className={item.planned ? PLANNED_DIMMED_CLASS : undefined}
      icon={remixIcon(item.icon)}
      isActive={isCurrent(pathname, item.to)}
      render={<Link to={item.to} />}
    >
      {item.label()}
    </SidebarMenuButton>
    {item.planned && (
      <SidebarMenuBadge className="text-muted-foreground/60">
        {m.shell_nav_planned_badge()}
      </SidebarMenuBadge>
    )}
  </SidebarMenuItem>
);

const NavAreaDisclosure = ({
  item,
  pathname,
}: {
  item: NavAreaEntry;
  pathname: string;
}) => {
  const title = item.label();
  const isAreaCurrent = isCurrent(pathname, item.to);
  const [open, setOpen] = useState(isAreaCurrent);

  return (
    <Collapsible
      onOpenChange={setOpen}
      open={open}
      render={<SidebarMenuItem />}
    >
      <SidebarMenuButton
        icon={remixIcon(item.icon)}
        isActive={isAreaCurrent && !open}
        render={<CollapsibleTrigger />}
      >
        {title}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          aria-hidden="true"
          className={CHEVRON_CLASS}
          initial={false}
          transition={spring.fast}
        >
          <RiArrowRightSLine className="size-3.5" />
        </motion.span>
      </SidebarMenuButton>
      <CollapsibleContent>
        <motion.div
          animate={open ? "open" : "closed"}
          initial="closed"
          variants={SUB_LIST_VARIANTS}
        >
          <SidebarMenuSub>
            {item.children.map((page) => (
              <MotionSidebarMenuSubItem
                key={page.to}
                variants={SUB_ROW_VARIANTS}
              >
                <SidebarMenuSubButton
                  isActive={isCurrent(pathname, page.to)}
                  render={<Link to={page.to} />}
                >
                  {page.label()}
                </SidebarMenuSubButton>
              </MotionSidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
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
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{m.nav_group_application()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) =>
                isNavArea(item) ? (
                  <NavAreaDisclosure
                    item={item}
                    key={item.to}
                    pathname={pathname}
                  />
                ) : (
                  <NavRow item={item} key={item.to} pathname={pathname} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarFirstSteps />
        <SidebarUserMenu />
      </SidebarFooter>
    </Sidebar>
  );
};
