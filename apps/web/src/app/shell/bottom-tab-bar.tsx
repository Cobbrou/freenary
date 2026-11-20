import { cn } from "@freenary/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";
import { HostAnimatedKubaiIcon } from "@/shared/lib/kubai-icon";

import { isCurrentNav, NAV_ITEMS } from "./nav-items";

export const BOTTOM_TAB_BAR_CLEARANCE =
  "pb-[calc(var(--bottom-tab-bar-height)+1rem)] md:pb-0";

export const BottomTabBar = () => {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <nav
      aria-label={m.nav_tab_bar_label()}
      data-slot="bottom-tab-bar"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const isCurrent = isCurrentNav(pathname, item.to);

          return (
            <li key={item.to}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex h-(--bottom-tab-bar-height) flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium outline-none focus-visible:ring-[3px]",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
                to={item.to}
              >
                <HostAnimatedKubaiIcon
                  aria-hidden="true"
                  color={isCurrent ? item.color : "currentColor"}
                  icon={item.icon}
                  size={22}
                />
                <span className="max-w-full truncate">{item.label()}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
