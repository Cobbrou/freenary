import { createFileRoute } from "@tanstack/react-router";

import { transactionListSearchSchema } from "@/features/transaction-list";
import { BankAccountPage } from "@/pages/bank-account";

export const Route = createFileRoute("/_auth/accounts/$accountId")({
  component: BankAccountPage,
  validateSearch: transactionListSearchSchema,
});
