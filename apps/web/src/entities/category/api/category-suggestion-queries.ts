import type { TransactionDirection } from "@freenary/api/lib/taxonomy";

import { orpc } from "@/shared/api";

const SUGGESTIONS_STALE_MS = 5 * 60 * 1000;

export const categorySuggestionStatusQueryOptions = () => ({
  ...orpc.budget.getCategorySuggestionStatus.queryOptions(),
  staleTime: Number.POSITIVE_INFINITY,
});

export const categorySuggestionsQueryOptions = (input: {
  currency?: string;
  direction: TransactionDirection;
  query: string;
}) => ({
  ...orpc.budget.suggestCategories.queryOptions({ input }),
  staleTime: SUGGESTIONS_STALE_MS,
});
