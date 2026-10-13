import { m } from "@/paraglide/messages.js";
import { docsUrl } from "@/shared/config";

type Label = () => string;

const FIELD_LABELS = {
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
} satisfies Record<string, Label>;

const INTEGRATION_TITLES = {
  banking: m.setup_integration_banking_title,
  email: m.setup_integration_email_title,
} satisfies Record<string, Label>;

const INTEGRATION_DESCRIPTIONS = {
  banking: m.setup_integration_banking_description,
  email: m.setup_integration_email_description,
} satisfies Record<string, Label>;

const STATE_LABELS = {
  configured: m.setup_state_configured,
  disabled: m.setup_state_disabled,
  incomplete: m.setup_state_incomplete,
} satisfies Record<string, Label>;

const STEP_LABELS = {
  banking: m.setup_step_bank,
  email: m.setup_step_email,
  finish: m.setup_step_finish,
} satisfies Record<string, Label>;

const VARIANT_LABELS = {
  disabled: m.setup_variant_disabled,
  "enable-banking": m.setup_variant_enable_banking,
  powens: m.setup_variant_powens,
  resend: m.setup_variant_resend,
  smtp: m.setup_variant_smtp,
} satisfies Record<string, Label>;

const VARIANT_GUIDE_PATHS: Record<string, string> = {
  "enable-banking": "/self-hosting/bank-providers#enable-banking",
  powens: "/self-hosting/bank-providers#powens",
  resend: "/self-hosting/email#resend",
  smtp: "/self-hosting/email#smtp",
};

const read = (table: Record<string, Label>, key: string): string =>
  table[key]?.() ?? key;

export const fieldLabel = (key: string): string => read(FIELD_LABELS, key);

export const integrationTitle = (id: string): string =>
  read(INTEGRATION_TITLES, id);

export const integrationDescription = (id: string): string =>
  read(INTEGRATION_DESCRIPTIONS, id);

export const variantLabel = (id: string): string => read(VARIANT_LABELS, id);

export const stateLabel = (id: string): string => read(STATE_LABELS, id);

export const stepLabel = (id: string): string => read(STEP_LABELS, id);

const ENVIRONMENT_DOCS_PATH =
  "/self-hosting/setup#a-value-in-the-environment-wins";

const RESTART_DOCS_PATH =
  "/self-hosting/troubleshooting#the-server-does-not-restart-after-setup";

export const environmentDocsUrl = (): string =>
  `${docsUrl()}${ENVIRONMENT_DOCS_PATH}`;

export const restartDocsUrl = (): string => `${docsUrl()}${RESTART_DOCS_PATH}`;

export const variantGuideUrl = (id: string): string | null => {
  const path = VARIANT_GUIDE_PATHS[id];

  return path === undefined ? null : `${docsUrl()}${path}`;
};
