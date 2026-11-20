import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { Link } from "@tanstack/react-router";

import type { DashboardSummary } from "@/entities/dashboard";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { recentDateLabel } from "@/shared/lib/calendar-day";
import { DashboardThumbnail } from "@/widgets/dashboard";

interface DashboardsStripProps {
  dashboards: DashboardSummary[] | undefined;
  today: Date;
}

const DASHBOARDS_SHOWN = 3;

const SKELETON_CARDS = 3;

const CARD_CLASS =
  "bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-w-0 flex-col gap-3 rounded-xl border p-2 pb-3 transition-colors duration-100 outline-none focus-visible:ring-[3px]";

export const DashboardsStrip = ({
  dashboards,
  today,
}: DashboardsStripProps) => (
  <section
    aria-labelledby="home-dashboards-title"
    className="flex flex-col gap-2"
  >
    <h2 className="text-sm font-medium" id="home-dashboards-title">
      {m.nav_dashboards()}
    </h2>
    {dashboards === undefined ? (
      <div
        aria-busy="true"
        className="grid grid-cols-2 gap-3 @2xl/home:grid-cols-4"
      >
        <output className="sr-only">{m.dashboards_loading()}</output>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <Skeleton
            aria-hidden="true"
            className="h-32 rounded-xl"
            key={index}
          />
        ))}
      </div>
    ) : (
      <ul className="grid grid-cols-2 gap-3 @2xl/home:grid-cols-4">
        {dashboards.slice(0, DASHBOARDS_SHOWN).map((dashboard) => (
          <li className="flex" key={dashboard.id}>
            <Link
              className={`${CARD_CLASS} flex-1`}
              params={{ dashboardId: dashboard.id }}
              to="/dashboards/$dashboardId"
            >
              <DashboardThumbnail widgetTypes={dashboard.widgetTypes} />
              <span className="flex min-w-0 flex-col px-1">
                <span
                  className="truncate text-sm font-medium"
                  title={dashboard.title}
                >
                  {dashboard.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {recentDateLabel(
                    new Date(dashboard.updatedAt),
                    today,
                    getLocale()
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
        <li className="flex">
          <Link
            className={`${CARD_CLASS} text-muted-foreground flex-1 items-center justify-center border-dashed p-3 text-center`}
            search={{ draft: m.dashboards_new_prompt() }}
            to="/ask"
          >
            <BrandAvatar className="size-7" frozen state="logo" />
            <span className="text-sm">
              {dashboards.length === 0
                ? m.home_dashboards_first()
                : m.home_dashboards_ask()}
            </span>
          </Link>
        </li>
      </ul>
    )}
  </section>
);
