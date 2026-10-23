import { ORPCError } from "@orpc/client";
import { z } from "zod";

const BANK_INTEGRATION = "banking";

const completionRefusal = z.object({ missing: z.array(z.string()) });

export type CompletionFailure = "failed" | "needs-bank";

const refusalNamesBank = (error: ORPCError<string, unknown>): boolean => {
  const refusal = completionRefusal.safeParse(error.data);

  return refusal.success && refusal.data.missing.includes(BANK_INTEGRATION);
};

export const completionFailureOf = (error: Error): CompletionFailure =>
  error instanceof ORPCError &&
  error.code === "PRECONDITION_FAILED" &&
  refusalNamesBank(error)
    ? "needs-bank"
    : "failed";
