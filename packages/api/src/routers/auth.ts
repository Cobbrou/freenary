import { authCapabilities } from "@freenary/auth";

import { publicProcedure } from "../index";

export const authRouter = {
  capabilities: publicProcedure.handler(() => authCapabilities),

  viewer: publicProcedure.handler(({ context }) => {
    const user = context.session?.user;
    const { sessionCookieShared } = authCapabilities;

    if (user === undefined) {
      return { kind: "guest" as const, sessionCookieShared };
    }

    const hasCompletedOnboarding =
      (user.onboardingCompletedAt ?? null) !== null;

    return {
      kind: "member" as const,
      onboarded: hasCompletedOnboarding,
      sessionCookieShared,
    };
  }),
};
