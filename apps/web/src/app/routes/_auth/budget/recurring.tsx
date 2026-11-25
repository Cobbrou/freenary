import { createFileRoute } from "@tanstack/react-router";

import { RecurringPage } from "@/pages/budget";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../../router/page-head";

export const Route = createFileRoute("/_auth/budget/recurring")({
  component: RecurringPage,
  head: pageHead(m.nav_budget_recurring),
});
