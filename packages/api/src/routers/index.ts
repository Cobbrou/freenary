import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { assistantRouter } from "./assistant";
import { authRouter } from "./auth";
import { bankConnectionRouter } from "./bank-connection";
import { budgetRouter } from "./budget";
import { dashboardsRouter } from "./dashboards";
import { instanceRouter } from "./instance";
import { notificationsRouter } from "./notifications";
import { onboardingRouter } from "./onboarding";
import { portfolioRouter } from "./portfolio";
import { settingsRouter } from "./settings";

export const appRouter = {
  assistant: assistantRouter,
  auth: authRouter,
  bankConnection: bankConnectionRouter,
  budget: budgetRouter,
  dashboards: dashboardsRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  instance: instanceRouter,
  notifications: notificationsRouter,
  onboarding: onboardingRouter,
  portfolio: portfolioRouter,
  settings: settingsRouter,
};

export type AppRouter = typeof appRouter;

export type AppRouterClient = RouterClient<typeof appRouter>;
