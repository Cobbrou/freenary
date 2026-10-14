import { createFileRoute, redirect } from "@tanstack/react-router";

import { OnboardingPage } from "@/pages/onboarding";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context: { instance, viewer } }) => {
    if (viewer.kind === "guest") {
      throw redirect({ to: "/login" });
    }

    if (instance.kind === "needs-setup") {
      throw redirect({ to: "/setup" });
    }

    if (viewer.kind === "member" && viewer.onboarded) {
      throw redirect({ to: "/" });
    }
  },
  component: OnboardingPage,
});
