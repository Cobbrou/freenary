import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@freenary/ui/components/breadcrumb";
import { Separator } from "@freenary/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@freenary/ui/components/sidebar";
import { TooltipProvider } from "@freenary/ui/components/tooltip";
import { cn } from "@freenary/ui/lib/utils";
import { Outlet } from "@tanstack/react-router";
import { Fragment } from "react";

import { AuthGate } from "@/features/auth-gate";

import { AppSidebar } from "./app-sidebar";
import { BOTTOM_TAB_BAR_CLEARANCE, BottomTabBar } from "./bottom-tab-bar";
import { AppCommandMenu } from "./command-menu";
import { isFullWidthRoute } from "./nav-items";
import { SyncProgressToast } from "./sync-progress-toast";
import { UpdateBanner } from "./update-banner";
import { useAvailableUpdate } from "./use-available-update";
import { useNavTrail } from "./use-nav-trail";

const SHELL_BELOW_THE_BANNER =
  "min-h-[calc(100svh-var(--update-banner-height,0px))]";

export const AuthLayout = () => {
  const { routeId, trail } = useNavTrail();
  const latestRelease = useAvailableUpdate();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col">
        <UpdateBanner latest={latestRelease} />
        <SidebarProvider className={SHELL_BELOW_THE_BANNER}>
          <AppSidebar />
          <SidebarInset className={BOTTOM_TAB_BAR_CLEARANCE}>
            <header className="flex h-16 shrink-0 items-center gap-2 px-4">
              <SidebarTrigger className="-ms-1" size="icon" />
              <Separator
                orientation="vertical"
                className="me-2 h-4 !self-auto"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  {trail.map((title, depth) => {
                    const isCurrentPage = depth === trail.length - 1;

                    return (
                      <Fragment key={`${depth}-${title}`}>
                        {depth > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                          {isCurrentPage ? (
                            <BreadcrumbPage
                              className="max-w-64 truncate"
                              title={title}
                            >
                              {title}
                            </BreadcrumbPage>
                          ) : (
                            title
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <SyncProgressToast />
            <div
              className={cn(
                "mx-auto flex w-full flex-1 flex-col",
                !isFullWidthRoute(routeId) && "max-w-5xl"
              )}
            >
              <AuthGate audience="member">
                <Outlet />
              </AuthGate>
            </div>
          </SidebarInset>
          <BottomTabBar />
        </SidebarProvider>
        <AppCommandMenu />
      </div>
    </TooltipProvider>
  );
};
