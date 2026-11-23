import { createFileRoute } from "@tanstack/react-router";

import { TransactionsPage, transactionsSearchSchema } from "@/pages/budget";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../../router/page-head";

export const Route = createFileRoute("/_auth/budget/transactions")({
  component: TransactionsPage,
  head: pageHead(m.nav_budget_transactions),
  validateSearch: transactionsSearchSchema,
});
