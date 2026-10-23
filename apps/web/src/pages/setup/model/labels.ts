import { m } from "@/paraglide/messages.js";

import type { CompletionFailure } from "./setup-steps";

type Label = () => string;

const STEP_LABELS = {
  banking: m.setup_step_bank,
  categorisation: m.setup_step_categorisation,
  finish: m.setup_step_finish,
} satisfies Record<string, Label>;

const COMPLETION_FAILURE_MESSAGES = {
  failed: m.setup_finish_error_generic,
  "needs-bank": m.setup_finish_error_bank,
} satisfies Record<CompletionFailure, Label>;

const read = (table: Record<string, Label>, key: string): string =>
  table[key]?.() ?? key;

export const stepLabel = (id: string): string => read(STEP_LABELS, id);

export const completionFailureMessage = (failure: CompletionFailure): string =>
  COMPLETION_FAILURE_MESSAGES[failure]();
