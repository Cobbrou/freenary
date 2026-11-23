import { Effect, Option } from "effect";
import { z } from "zod";

import type {
  CategorySuggester,
  SuggestionRequest,
} from "../categorisation/classifier/suggest";
import { categorySuggester } from "../categorisation/classifier/suggest";
import { protectedProcedure } from "../index";
import type { SpendingCategory } from "../lib/taxonomy";
import { TRANSACTION_DIRECTIONS } from "../lib/taxonomy";
import { userCurrency } from "../lib/user-currency";

const MAX_SUGGESTION_QUERY_LENGTH = 120;

const suggestInput = z.object({
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/u)
    .transform((code) => code.toUpperCase())
    .optional(),
  direction: z.enum(TRANSACTION_DIRECTIONS),
  query: z.string().trim().min(1).max(MAX_SUGGESTION_QUERY_LENGTH),
});

const askSuggester = (
  suggester: CategorySuggester,
  request: SuggestionRequest
): Promise<SpendingCategory[]> =>
  Effect.runPromise(
    Effect.tryPromise({
      catch: String,
      try: () => suggester.suggest(request),
    }).pipe(
      Effect.tapError((reason) =>
        Effect.sync(() => {
          console.warn(`[categorisation] suggestions: ${reason}`);
        })
      ),
      Effect.orElseSucceed((): SpendingCategory[] => [])
    )
  );

export const categorySuggestionProcedures = {
  getCategorySuggestionStatus: protectedProcedure.handler(() => ({
    enabled: Option.isSome(categorySuggester),
  })),

  suggestCategories: protectedProcedure
    .input(suggestInput)
    .handler(async ({ context, input }) => {
      if (Option.isNone(categorySuggester)) {
        return { categories: [] };
      }

      const currency =
        input.currency ?? (await userCurrency(context.session.user.id));

      return {
        categories: await askSuggester(categorySuggester.value, {
          currency,
          direction: input.direction === "incoming" ? "credit" : "debit",
          query: input.query,
        }),
      };
    }),
};
