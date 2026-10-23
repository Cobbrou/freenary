import { m } from "@/paraglide/messages.js";

type Label = () => string;

const STEP_LABELS = {
  assistant: m.setup_step_assistant,
  banking: m.setup_step_bank,
  categorisation: m.setup_step_categorisation,
  email: m.setup_step_email,
  finish: m.setup_step_finish,
} satisfies Record<string, Label>;

const read = (table: Record<string, Label>, key: string): string =>
  table[key]?.() ?? key;

export const stepLabel = (id: string): string => read(STEP_LABELS, id);
