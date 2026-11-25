import { createFileRoute, redirect } from "@tanstack/react-router";

import { SetupPage } from "@/pages/setup";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../router/page-head";

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ context: { viewer } }) => {
    if (viewer.kind === "guest") {
      throw redirect({ to: "/login" });
    }
  },
  component: SetupPage,
  head: pageHead(m.page_title_setup),
});
