import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/pages/dashboard";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../../router/page-head";

export const Route = createFileRoute("/_auth/dashboards/$dashboardId")({
  component: DashboardPage,
  head: pageHead(m.nav_dashboards),
});
