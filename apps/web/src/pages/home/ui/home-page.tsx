import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { dashboardsQueryOptions } from "@/entities/dashboard";
import { useStartChat } from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";
import { startOfDay } from "@/shared/lib/calendar-day";
import { NoBankAccount } from "@/shared/ui/no-bank-account";
import { AccountStrip, DashboardGrid } from "@/widgets/dashboard";

import { greetingFor } from "../model/greeting";
import { HOME_WIDGETS } from "../model/home-widgets";
import { DashboardsStrip } from "./dashboards-strip";
import { HomeAskForm } from "./home-ask-form";

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: "long" };

export const HomePage = () => {
  const now = useMemo(() => new Date(), []);
  const today = startOfDay(now);
  const { data: session } = authClient.useSession();
  const overview = useQuery(orpc.portfolio.getOverview.queryOptions());
  const dashboards = useQuery(dashboardsQueryOptions());
  const { isStarting, startChat } = useStartChat();
  const firstName = session?.user.name.split(" ")[0] ?? "";

  if (overview.data?.accounts.length === 0) {
    return (
      <NoBankAccount
        actionLabel={m.budget_no_account_cta()}
        description={m.home_no_account_description()}
        title={m.home_no_account_title()}
      />
    );
  }

  return (
    <div className="@container/home mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4">
      <section className="flex flex-col items-center gap-4 pt-4 text-center">
        <BrandAvatar className="size-12" state="idle" />
        <h1
          className="font-heading text-2xl font-semibold tracking-tight text-balance"
          suppressHydrationWarning
        >
          {greetingFor(now.getHours(), firstName)}
        </h1>
        <HomeAskForm isStarting={isStarting} onAsk={startChat} />
      </section>
      <DashboardsStrip dashboards={dashboards.data?.dashboards} today={today} />
      <AccountStrip />
      <section
        aria-labelledby="home-overview-title"
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-sm font-medium" id="home-overview-title">
            {m.home_overview_title()}
          </h2>
          <span className="text-muted-foreground text-xs">
            {m.home_overview_hint({
              month: now.toLocaleDateString(getLocale(), MONTH_FORMAT),
            })}
          </span>
        </div>
        <DashboardGrid onAsk={startChat} today={today} widgets={HOME_WIDGETS} />
      </section>
    </div>
  );
};
