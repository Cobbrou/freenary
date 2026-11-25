import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { LoginPage } from "@/pages/login";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../router/page-head";

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
  head: pageHead(m.page_title_login),
  validateSearch: loginSearchSchema,
});
