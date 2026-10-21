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
import { Outlet, useMatches } from "@tanstack/react-router";
import { Fragment } from "react";

import { AuthGate } from "@/features/auth-gate";

import { AppSidebar } from "./app-sidebar";
import { navTrailOf } from "./nav-items";
import { SyncProgressToast } from "./sync-progress-toast";

export const AuthLayout = () => {
  const matches = useMatches();
  const trail = navTrailOf(matches.at(-1)?.routeId);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ms-1" size="icon" />
            <Separator orientation="vertical" className="me-2 h-4 !self-auto" />
            <Breadcrumb>
              <BreadcrumbList>
                {trail.map((title, depth) => {
                  const isCurrentPage = depth === trail.length - 1;

                  return (
                    <Fragment key={title}>
                      {depth > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {isCurrentPage ? (
                          <BreadcrumbPage>{title}</BreadcrumbPage>
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
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
            <AuthGate audience="member">
              <Outlet />
            </AuthGate>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};
