import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { assistantRouter } from "./assistant";
import { authRouter } from "./auth";
import { bankConnectionRouter } from "./bank-connection";
import { budgetRouter } from "./budget";
import { instanceRouter } from "./instance";
import { onboardingRouter } from "./onboarding";
import { settingsRouter } from "./settings";

export const appRouter = {
  assistant: assistantRouter,
  auth: authRouter,
  bankConnection: bankConnectionRouter,
  budget: budgetRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  instance: instanceRouter,
  onboarding: onboardingRouter,
  settings: settingsRouter,
};

export type AppRouter = typeof appRouter;

export type AppRouterClient = RouterClient<typeof appRouter>;
