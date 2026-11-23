import { createFileRoute } from "@tanstack/react-router";

import { transactionListSearchSchema } from "@/features/transaction-list";
import { BankAccountPage } from "@/pages/bank-account";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../../router/page-head";

export const Route = createFileRoute("/_auth/accounts/$accountId")({
  component: BankAccountPage,
  head: pageHead(m.nav_bank_account),
  validateSearch: transactionListSearchSchema,
});
