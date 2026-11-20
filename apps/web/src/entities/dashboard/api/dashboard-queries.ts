import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

import { orpc } from "@/shared/api";

export type DashboardSummary =
  InferRouterOutputs<AppRouter>["dashboards"]["list"]["dashboards"][number];

export const dashboardsQueryOptions = () => orpc.dashboards.list.queryOptions();

export const dashboardQueryOptions = (dashboardId: string) =>
  orpc.dashboards.get.queryOptions({ input: { dashboardId } });
