import type { serverEnvSchema } from "@freenary/env/schema";
import { Option } from "effect";

export type ServerSettingKey = keyof typeof serverEnvSchema;

export type IntegrationFieldKind =
  | "text"
  | "url"
  | "secret"
  | "secret-block"
  | "port"
  | "toggle";

export interface IntegrationField {
  readonly key: ServerSettingKey;
  readonly kind: IntegrationFieldKind;
  readonly required: boolean;
}

export interface IntegrationVariant {
  readonly id: string;
  readonly discriminantValue: string | null;
  readonly fields: readonly IntegrationField[];
}

export interface Integration {
  readonly id: string;
  readonly discriminantKey: ServerSettingKey;
  readonly variants: readonly IntegrationVariant[];
}

const bankingIntegration: Integration = {
  discriminantKey: "BANKING_PROVIDER",
  id: "banking",
  variants: [
    { discriminantValue: null, fields: [], id: "disabled" },
    {
      discriminantValue: "powens",
      fields: [
        { key: "POWENS_DOMAIN", kind: "text", required: true },
        { key: "POWENS_CLIENT_ID", kind: "text", required: true },
        { key: "POWENS_CLIENT_SECRET", kind: "secret", required: true },
      ],
      id: "powens",
    },
    {
      discriminantValue: "enable-banking",
      fields: [
        { key: "ENABLE_BANKING_APP_ID", kind: "text", required: true },
        {
          key: "ENABLE_BANKING_PRIVATE_KEY",
          kind: "secret-block",
          required: true,
        },
      ],
      id: "enable-banking",
    },
  ],
};

const emailIntegration: Integration = {
  discriminantKey: "EMAIL_PROVIDER",
  id: "email",
  variants: [
    { discriminantValue: null, fields: [], id: "disabled" },
    {
      discriminantValue: "resend",
      fields: [
        { key: "EMAIL_FROM", kind: "text", required: true },
        { key: "RESEND_API_KEY", kind: "secret", required: true },
      ],
      id: "resend",
    },
    {
      discriminantValue: "smtp",
      fields: [
        { key: "EMAIL_FROM", kind: "text", required: true },
        { key: "SMTP_HOST", kind: "text", required: true },
        { key: "SMTP_PORT", kind: "port", required: false },
        { key: "SMTP_SECURE", kind: "toggle", required: false },
        { key: "SMTP_USER", kind: "text", required: false },
        { key: "SMTP_PASSWORD", kind: "secret", required: false },
      ],
      id: "smtp",
    },
  ],
};

export const integrations: readonly Integration[] = [
  bankingIntegration,
  emailIntegration,
];

export const findIntegration = (id: string): Option.Option<Integration> =>
  Option.fromNullishOr(
    integrations.find((integration) => integration.id === id)
  );

export const findVariant = (
  integration: Integration,
  id: string
): Option.Option<IntegrationVariant> =>
  Option.fromNullishOr(
    integration.variants.find((variant) => variant.id === id)
  );

export const keysOf = (integration: Integration): ServerSettingKey[] => {
  const keys = new Set<ServerSettingKey>([integration.discriminantKey]);

  for (const variant of integration.variants) {
    for (const field of variant.fields) {
      keys.add(field.key);
    }
  }

  return [...keys];
};

export const instanceConfigurableKeys: ReadonlySet<ServerSettingKey> = new Set(
  integrations.flatMap(keysOf)
);

export const isSecretField = (kind: IntegrationFieldKind): boolean =>
  kind === "secret" || kind === "secret-block";
