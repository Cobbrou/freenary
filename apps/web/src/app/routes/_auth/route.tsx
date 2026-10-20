import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthLayout } from "../../shell/auth-layout";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context: { instance, viewer } }) => {
    if (viewer.kind === "guest") {
      throw redirect({ to: "/login" });
    }

    if (instance.kind === "needs-setup") {
      throw redirect({ to: "/setup" });
    }

    if (viewer.kind === "member" && !viewer.onboarded) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthLayout,
});
