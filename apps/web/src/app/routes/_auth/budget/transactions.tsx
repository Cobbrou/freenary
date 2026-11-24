import { createFileRoute } from "@tanstack/react-router";

import { TransactionsPage, transactionsSearchSchema } from "@/pages/budget";

export const Route = createFileRoute("/_auth/budget/transactions")({
  component: TransactionsPage,
  validateSearch: transactionsSearchSchema,
});
