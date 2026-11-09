import { useSuspenseQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api";

export const useBudgetCurrency = (): string =>
  useSuspenseQuery(orpc.budget.getAccounts.queryOptions()).data.currency;
