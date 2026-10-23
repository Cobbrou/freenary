import { m } from "@/paraglide/messages.js";

type Label = () => string;

export type IntegrationWording = "settings" | "setup";

export const SKIP_LABELS = {
  settings: m.setup_variant_off,
  setup: m.setup_variant_disabled,
} satisfies Record<IntegrationWording, Label>;

export const SAVE_LABELS = {
  settings: m.setup_save,
  setup: m.setup_save_and_continue,
} satisfies Record<IntegrationWording, Label>;

export const ENVIRONMENT_DONE_LABELS = {
  settings: m.setup_done,
  setup: m.setup_continue,
} satisfies Record<IntegrationWording, Label>;
