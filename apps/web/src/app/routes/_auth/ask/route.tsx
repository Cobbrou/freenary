import { createFileRoute } from "@tanstack/react-router";

import { AskArea } from "@/pages/assistant";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../../router/page-head";

export const Route = createFileRoute("/_auth/ask")({
  component: AskArea,
  head: pageHead(m.nav_ask),
});
