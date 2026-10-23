import { m } from "@/paraglide/messages.js";
import { docsUrl } from "@/shared/config";

import type { MessagePart } from "../lib/message-parts";
import { code, messageParts, strong } from "../lib/message-parts";
import type { FieldProblem } from "./field-rules";

type Label = () => string;

export const POWENS_CLIENT_APPLICATIONS = "Client Applications";

const FIELD_LABELS = {
  AI_API_KEY: m.setup_field_ai_api_key,
  AI_BASE_URL: m.setup_field_ai_base_url,
  AI_MODEL: m.setup_field_ai_model,
  EMAIL_FROM: m.setup_field_email_from,
  ENABLE_BANKING_APP_ID: m.setup_field_enable_banking_app_id,
  ENABLE_BANKING_PRIVATE_KEY: m.setup_field_enable_banking_private_key,
  POWENS_CLIENT_ID: m.setup_field_powens_client_id,
  POWENS_CLIENT_SECRET: m.setup_field_powens_client_secret,
  POWENS_DOMAIN: m.setup_field_powens_domain,
  RESEND_API_KEY: m.setup_field_resend_api_key,
  SMTP_HOST: m.setup_field_smtp_host,
  SMTP_PASSWORD: m.setup_field_smtp_password,
  SMTP_PORT: m.setup_field_smtp_port,
  SMTP_SECURE: m.setup_field_smtp_secure,
  SMTP_USER: m.setup_field_smtp_user,
  TRANSACTION_CLASSIFIER_API_KEY: m.setup_field_classifier_api_key,
  TRANSACTION_CLASSIFIER_MODEL: m.setup_field_classifier_model,
  TRANSACTION_CLASSIFIER_URL: m.setup_field_classifier_url,
} satisfies Record<string, Label>;

const powensClientHelp = (): MessagePart[] =>
  messageParts(m.setup_field_powens_client_help, {
    section: strong(POWENS_CLIENT_APPLICATIONS),
  });

const FIELD_HELP: Readonly<Record<string, () => MessagePart[]>> = {
  POWENS_CLIENT_ID: powensClientHelp,
  POWENS_CLIENT_SECRET: powensClientHelp,
  POWENS_DOMAIN: () =>
    messageParts(m.setup_field_powens_domain_help, {
      example: code("acme-sandbox"),
      scheme: code("https://"),
    }),
};

const FIELD_PROBLEMS = {
  "domain-has-scheme": m.setup_field_powens_domain_has_scheme,
} satisfies Record<FieldProblem, Label>;

const INTEGRATION_TITLES = {
  assistant: m.setup_integration_assistant_title,
  banking: m.setup_integration_banking_title,
  categorisation: m.setup_integration_categorisation_title,
  email: m.setup_integration_email_title,
} satisfies Record<string, Label>;

const INTEGRATION_DESCRIPTIONS = {
  assistant: m.setup_integration_assistant_description,
  banking: m.setup_integration_banking_description,
  categorisation: m.setup_integration_categorisation_description,
  email: m.setup_integration_email_description,
} satisfies Record<string, Label>;

const STATE_LABELS = {
  configured: m.setup_state_configured,
  disabled: m.setup_state_disabled,
  incomplete: m.setup_state_incomplete,
} satisfies Record<string, Label>;

const VARIANT_LABELS = {
  disabled: m.setup_variant_disabled,
  "enable-banking": m.setup_variant_enable_banking,
  jev: m.setup_variant_jev,
  laya: m.setup_variant_laya,
  llm: m.setup_variant_llm,
  mock: m.setup_variant_mock,
  "openai-compatible": m.setup_variant_openai_compatible,
  powens: m.setup_variant_powens,
  resend: m.setup_variant_resend,
  smtp: m.setup_variant_smtp,
  "subq-snap": m.setup_variant_subq_snap,
  "system-one": m.setup_variant_system_one,
  von: m.setup_variant_von,
  "zero-shot": m.setup_variant_zero_shot,
} satisfies Record<string, Label>;

const VARIANT_DESCRIPTIONS = {
  "assistant:disabled": m.setup_variant_assistant_disabled_description,
  "assistant:openai-compatible":
    m.setup_variant_assistant_openai_compatible_description,
  "banking:powens": m.setup_variant_powens_description,
  "categorisation:disabled":
    m.setup_variant_categorisation_disabled_description,
  "categorisation:jev": m.setup_variant_jev_description,
  "categorisation:laya": m.setup_variant_laya_description,
  "categorisation:llm": m.setup_variant_llm_description,
  "categorisation:subq-snap": m.setup_variant_subq_snap_description,
  "categorisation:system-one": m.setup_variant_system_one_description,
  "categorisation:von": m.setup_variant_von_description,
  "categorisation:zero-shot": m.setup_variant_zero_shot_description,
} satisfies Record<string, Label>;

const VARIANT_GUIDE_PATHS: Record<string, string> = {
  "enable-banking": "/reference/bank-providers#enable-banking",
  jev: "/run/models#jev",
  laya: "/run/models#laya",
  llm: "/run/models#a-language-model",
  "openai-compatible": "/run/models#assistant",
  powens: "/reference/bank-providers#powens",
  resend: "/run/email#resend",
  smtp: "/run/email#smtp",
  "subq-snap": "/run/models#subq-snap",
  "system-one": "/run/models#another-system-one-server",
  von: "/run/models#von",
  "zero-shot": "/run/models#a-zero-shot-classifier",
};

const read = (table: Record<string, Label>, key: string): string =>
  table[key]?.() ?? key;

const readIfKnown = (
  table: Record<string, Label>,
  key: string
): string | null => table[key]?.() ?? null;

export const fieldLabel = (key: string): string => read(FIELD_LABELS, key);

export const fieldHelp = (key: string): MessagePart[] | null =>
  FIELD_HELP[key]?.() ?? null;

export const fieldProblemMessage = (problem: FieldProblem): string =>
  FIELD_PROBLEMS[problem]();

export const integrationTitle = (id: string): string =>
  read(INTEGRATION_TITLES, id);

export const integrationDescription = (id: string): string =>
  read(INTEGRATION_DESCRIPTIONS, id);

export const variantLabel = (id: string): string => read(VARIANT_LABELS, id);

export const variantDescription = (
  integrationId: string,
  variantId: string
): string | null =>
  readIfKnown(VARIANT_DESCRIPTIONS, `${integrationId}:${variantId}`);

export const stateLabel = (id: string): string => read(STATE_LABELS, id);

const ENVIRONMENT_DOCS_PATH =
  "/reference/configuration#a-value-in-the-environment-wins";

const RESTART_DOCS_PATH =
  "/run/troubleshooting#the-server-does-not-restart-after-setup";

export const environmentDocsUrl = (): string =>
  `${docsUrl()}${ENVIRONMENT_DOCS_PATH}`;

export const restartDocsUrl = (): string => `${docsUrl()}${RESTART_DOCS_PATH}`;

export const variantGuideUrl = (id: string): string | null => {
  const path = VARIANT_GUIDE_PATHS[id];

  return path === undefined ? null : `${docsUrl()}${path}`;
};
