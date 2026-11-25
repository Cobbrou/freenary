import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/pages/home";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../router/page-head";

export const Route = createFileRoute("/_auth/")({
  component: HomePage,
  head: pageHead(m.nav_home),
});
