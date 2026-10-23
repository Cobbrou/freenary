import type { CompletionFailure } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";

const APPLY_FAILURE_MESSAGES = {
  failed: m.settings_integrations_apply_failed,
  "needs-bank": m.settings_integrations_apply_needs_bank_provider,
} satisfies Record<CompletionFailure, () => string>;

export const applyFailureMessage = (failure: CompletionFailure): string =>
  APPLY_FAILURE_MESSAGES[failure]();
