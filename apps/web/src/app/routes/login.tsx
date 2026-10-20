import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { LoginPage } from "@/pages/login";

const loginSearchSchema = z.object({ error: z.string().optional() });

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context: { instance, viewer } }) => {
    if (viewer.kind !== "member") {
      return;
    }

    if (instance.kind === "needs-setup") {
      throw redirect({ to: "/setup" });
    }

    throw redirect({ to: viewer.onboarded ? "/" : "/onboarding" });
  },
  component: LoginPage,
  validateSearch: loginSearchSchema,
});
