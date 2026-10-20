import type { StoredSettings } from "@freenary/instance-config/candidate";
import type {
  Integration,
  IntegrationVariant,
  ServerSettingKey,
} from "@freenary/instance-config/integrations";
import { isSecretField, keysOf } from "@freenary/instance-config/integrations";

export type OwnedByEnvironment = (key: ServerSettingKey) => boolean;

export const candidateOf = (
  integration: Integration,
  variant: IntegrationVariant,
  supplied: Readonly<Record<string, string>>,
  stored: StoredSettings,
  ownedByEnvironment: OwnedByEnvironment
): Record<string, string> => {
  const owned = new Set<string>(keysOf(integration));
  const candidate: Record<string, string> = {};

  for (const [key, held] of Object.entries(stored)) {
    if (!owned.has(key)) {
      candidate[key] = held;
    }
  }

  if (
    variant.discriminantValue !== null &&
    !ownedByEnvironment(integration.discriminantKey)
  ) {
    candidate[integration.discriminantKey] = variant.discriminantValue;
  }

  for (const field of variant.fields) {
    const offered = supplied[field.key]?.trim();
    const kept = stored[field.key];

    if (ownedByEnvironment(field.key)) {
      continue;
    }

    if (offered !== undefined && offered !== "") {
      candidate[field.key] = offered;
    } else if (isSecretField(field.kind) && kept !== undefined) {
      candidate[field.key] = kept;
    }
  }

  return candidate;
};

export const missingKeysOf = (
  variant: IntegrationVariant,
  candidate: Readonly<Record<string, string>>,
  ownedByEnvironment: OwnedByEnvironment
): ServerSettingKey[] =>
  variant.fields.flatMap((field) =>
    field.required &&
    !ownedByEnvironment(field.key) &&
    candidate[field.key] === undefined
      ? [field.key]
      : []
  );

export const isWhollyOwnedByEnvironment = (
  integration: Integration,
  variant: IntegrationVariant,
  ownedByEnvironment: OwnedByEnvironment
): boolean =>
  ownedByEnvironment(integration.discriminantKey) &&
  variant.fields.every((field) => ownedByEnvironment(field.key));

export const writesOf = (
  integration: Integration,
  candidate: Readonly<Record<string, string>>,
  ownedByEnvironment: OwnedByEnvironment
): Map<string, string | null> => {
  const writes = new Map<string, string | null>();

  for (const key of keysOf(integration)) {
    if (!ownedByEnvironment(key)) {
      writes.set(key, candidate[key] ?? null);
    }
  }

  return writes;
};

export const environmentVariantOf = (
  integration: Integration,
  storedProvider: string | undefined,
  providerFromEnvironment: string | undefined,
  ownedByEnvironment: OwnedByEnvironment
): IntegrationVariant | null => {
  if (
    storedProvider !== undefined &&
    !ownedByEnvironment(integration.discriminantKey)
  ) {
    return null;
  }

  const inForce = integration.variants.find(
    (variant) =>
      variant.discriminantValue !== null &&
      variant.discriminantValue === providerFromEnvironment
  );

  if (inForce === undefined) {
    return null;
  }

  const fullyOwned = inForce.fields.every(
    (field) => !field.required || ownedByEnvironment(field.key)
  );

  return fullyOwned ? inForce : null;
};
