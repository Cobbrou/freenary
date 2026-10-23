import { ORPCError } from "@orpc/client";
import { z } from "zod";

export const FINISH_STEP = "finish";

const BANK_INTEGRATION = "banking";

const setupRefusal = z.object({ missing: z.array(z.string()) });

interface SetupStanding {
  id: string;
  shownInSetup: boolean;
}

export type CompletionFailure = "failed" | "needs-bank";

export const setupIntegrationsOf = <Integration extends SetupStanding>(
  integrations: readonly Integration[]
): Integration[] =>
  integrations.filter((integration) => integration.shownInSetup);

export const setupStepsOf = (
  integrations: readonly SetupStanding[]
): string[] => [
  ...setupIntegrationsOf(integrations).map((integration) => integration.id),
  FINISH_STEP,
];

const refusalNamesBank = (error: ORPCError<string, unknown>): boolean => {
  const refusal = setupRefusal.safeParse(error.data);

  return refusal.success && refusal.data.missing.includes(BANK_INTEGRATION);
};

export const completionFailureOf = (error: Error): CompletionFailure =>
  error instanceof ORPCError &&
  error.code === "PRECONDITION_FAILED" &&
  refusalNamesBank(error)
    ? "needs-bank"
    : "failed";
