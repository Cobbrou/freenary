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
  readonly suggestion?: string;
}

export interface IntegrationPreset {
  readonly key: ServerSettingKey;
  readonly value: string;
}

export interface IntegrationVariant {
  readonly id: string;
  readonly discriminantValue: string | null;
  readonly fields: readonly IntegrationField[];
  readonly presets?: readonly IntegrationPreset[];
  readonly recognisedOnlyWhenRemembered?: boolean;
  readonly recommended?: boolean;
}

export type SetupRole = "required" | "skippable" | "not-in-setup";

export interface Integration {
  readonly id: string;
  readonly discriminantKey: ServerSettingKey;
  readonly setup: SetupRole;
  readonly variants: readonly IntegrationVariant[];
}

const isProduction = process.env.NODE_ENV === "production";

const developmentOnlyBankingVariants: readonly IntegrationVariant[] =
  isProduction ? [] : [{ discriminantValue: "mock", fields: [], id: "mock" }];

export type HeldValue = (key: ServerSettingKey) => string | undefined;

const bankingIntegration: Integration = {
  discriminantKey: "BANKING_PROVIDER",
  id: "banking",
  setup: "required",
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
      recommended: true,
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
    ...developmentOnlyBankingVariants,
  ],
};

const emailIntegration: Integration = {
  discriminantKey: "EMAIL_PROVIDER",
  id: "email",
  setup: "not-in-setup",
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

const assistantIntegration: Integration = {
  discriminantKey: "AI_BASE_URL",
  id: "assistant",
  setup: "not-in-setup",
  variants: [
    { discriminantValue: null, fields: [], id: "disabled" },
    {
      discriminantValue: null,
      fields: [
        { key: "AI_BASE_URL", kind: "url", required: true },
        { key: "AI_MODEL", kind: "text", required: true },
        { key: "AI_API_KEY", kind: "secret", required: false },
      ],
      id: "openai-compatible",
    },
  ],
};

const TYPESAFE_SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
const SUBQ_SYSTEM_ONE_URL = "https://api.subq.ai/v1/systemone";

const hostedSystemOneFields = (
  suggestedModel: string
): readonly IntegrationField[] => [
  {
    key: "TRANSACTION_CLASSIFIER_MODEL",
    kind: "text",
    required: true,
    suggestion: suggestedModel,
  },
  { key: "TRANSACTION_CLASSIFIER_API_KEY", kind: "secret", required: true },
];

interface EndpointSuggestions {
  readonly model?: string;
  readonly url?: string;
}

const selfHostedClassifierFields = (
  suggestions: EndpointSuggestions
): readonly IntegrationField[] => [
  {
    key: "TRANSACTION_CLASSIFIER_URL",
    kind: "url",
    required: true,
    suggestion: suggestions.url,
  },
  {
    key: "TRANSACTION_CLASSIFIER_MODEL",
    kind: "text",
    required: true,
    suggestion: suggestions.model,
  },
  { key: "TRANSACTION_CLASSIFIER_API_KEY", kind: "secret", required: false },
];

const categorisationIntegration: Integration = {
  discriminantKey: "TRANSACTION_CLASSIFIER",
  id: "categorisation",
  setup: "skippable",
  variants: [
    { discriminantValue: null, fields: [], id: "disabled" },
    {
      discriminantValue: "system-one",
      fields: hostedSystemOneFields("jev-latest"),
      id: "jev",
      presets: [
        { key: "TRANSACTION_CLASSIFIER_URL", value: TYPESAFE_SYSTEM_ONE_URL },
      ],
    },
    {
      discriminantValue: "system-one",
      fields: hostedSystemOneFields("subq-snap-preview"),
      id: "subq-snap",
      presets: [
        { key: "TRANSACTION_CLASSIFIER_URL", value: SUBQ_SYSTEM_ONE_URL },
      ],
    },
    {
      discriminantValue: "system-one",
      fields: selfHostedClassifierFields({
        model: "von-latest",
        url: "http://von:8000/v1/systemone",
      }),
      id: "von",
      recognisedOnlyWhenRemembered: true,
    },
    {
      discriminantValue: "system-one",
      fields: selfHostedClassifierFields({
        model: "multilingual",
        url: "http://laya:8000/v1/systemone",
      }),
      id: "laya",
      recognisedOnlyWhenRemembered: true,
    },
    {
      discriminantValue: "system-one",
      fields: selfHostedClassifierFields({}),
      id: "system-one",
    },
    {
      discriminantValue: "llm",
      fields: selfHostedClassifierFields({}),
      id: "llm",
    },
    {
      discriminantValue: "zero-shot",
      fields: selfHostedClassifierFields({}),
      id: "zero-shot",
    },
  ],
};

export const integrations: readonly Integration[] = [
  bankingIntegration,
  emailIntegration,
  assistantIntegration,
  categorisationIntegration,
];

export const isShownInSetup = (integration: Integration): boolean =>
  integration.setup !== "not-in-setup";

export const isRequiredForSetup = (integration: Integration): boolean =>
  integration.setup === "required";

export const setupIntegrations: readonly Integration[] =
  integrations.filter(isShownInSetup);

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

export const presetsOf = (
  variant: IntegrationVariant
): readonly IntegrationPreset[] => variant.presets ?? [];

export const keysOf = (integration: Integration): ServerSettingKey[] => {
  const keys = new Set<ServerSettingKey>([integration.discriminantKey]);

  for (const variant of integration.variants) {
    for (const field of variant.fields) {
      keys.add(field.key);
    }

    for (const preset of presetsOf(variant)) {
      keys.add(preset.key);
    }
  }

  return [...keys];
};

export const instanceConfigurableKeys: ReadonlySet<ServerSettingKey> = new Set(
  integrations.flatMap(keysOf)
);

export const rememberedVariantKey = (integration: Integration): string =>
  `variant:${integration.id}`;

const suppliesDiscriminant = (
  integration: Integration,
  variant: IntegrationVariant
): boolean =>
  variant.fields.some((field) => field.key === integration.discriminantKey);

export const isOffVariant = (
  integration: Integration,
  variant: IntegrationVariant
): boolean =>
  variant.discriminantValue === null &&
  !suppliesDiscriminant(integration, variant);

const accepts = (
  integration: Integration,
  variant: IntegrationVariant,
  held: HeldValue
): boolean => {
  const discriminant = held(integration.discriminantKey);

  if (isOffVariant(integration, variant)) {
    return discriminant === undefined;
  }

  const discriminantFits =
    discriminant !== undefined &&
    (variant.discriminantValue === null ||
      variant.discriminantValue === discriminant);

  return (
    discriminantFits &&
    presetsOf(variant).every((preset) => held(preset.key) === preset.value)
  );
};

const specificityOf = (variant: IntegrationVariant): number =>
  (variant.discriminantValue === null ? 0 : 1) + presetsOf(variant).length;

export const recogniseVariant = (
  integration: Integration,
  held: HeldValue,
  remembered: string | undefined
): Option.Option<IntegrationVariant> => {
  const accepted = integration.variants.filter((variant) =>
    accepts(integration, variant, held)
  );

  const highest = Math.max(0, ...accepted.map(specificityOf));
  const mostSpecific = accepted.filter(
    (variant) => specificityOf(variant) === highest
  );

  const chosenBefore = mostSpecific.find(
    (variant) => variant.id === remembered
  );

  return Option.fromNullishOr(
    chosenBefore ??
      mostSpecific.find(
        (variant) => variant.recognisedOnlyWhenRemembered !== true
      )
  );
};

export const isSecretField = (kind: IntegrationFieldKind): boolean =>
  kind === "secret" || kind === "secret-block";
