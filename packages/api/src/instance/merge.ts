import type { StoredSettings } from "@freenary/instance-config/candidate";
import type {
  HeldValue,
  Integration,
  IntegrationVariant,
  ServerSettingKey,
} from "@freenary/instance-config/integrations";
import {
  isOffVariant,
  isSecretField,
  keysOf,
  presetsOf,
  recogniseVariant,
  rememberedVariantKey,
} from "@freenary/instance-config/integrations";
import { Option } from "effect";

export type OwnedByEnvironment = (key: ServerSettingKey) => boolean;

const offeredValue = (
  supplied: Readonly<Record<string, string>>,
  key: string
): string | undefined => {
  const offered = supplied[key]?.trim();

  return offered === "" ? undefined : offered;
};

const isEndpointUnchanged = (
  variant: IntegrationVariant,
  candidate: Readonly<Record<string, string>>,
  stored: StoredSettings
): boolean =>
  [
    ...variant.fields.flatMap((field) =>
      field.kind === "url" ? [field.key] : []
    ),
    ...presetsOf(variant).map((preset) => preset.key),
  ].every((key) => candidate[key] === stored[key]);

const fillSecrets = (
  candidate: Record<string, string>,
  variant: IntegrationVariant,
  supplied: Readonly<Record<string, string>>,
  stored: StoredSettings,
  ownedByEnvironment: OwnedByEnvironment,
  keepsStoredSecrets: boolean
): void => {
  const keeps =
    keepsStoredSecrets && isEndpointUnchanged(variant, candidate, stored);

  for (const field of variant.fields) {
    if (isSecretField(field.kind) && !ownedByEnvironment(field.key)) {
      const filled =
        offeredValue(supplied, field.key) ??
        (keeps ? stored[field.key] : undefined);

      if (filled !== undefined) {
        candidate[field.key] = filled;
      }
    }
  }
};

export const candidateOf = (
  integration: Integration,
  variant: IntegrationVariant,
  supplied: Readonly<Record<string, string>>,
  stored: StoredSettings,
  ownedByEnvironment: OwnedByEnvironment,
  keepsStoredSecrets = true
): Record<string, string> => {
  const remembered = rememberedVariantKey(integration);
  const owned = new Set<string>([...keysOf(integration), remembered]);
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

  for (const preset of presetsOf(variant)) {
    if (!ownedByEnvironment(preset.key)) {
      candidate[preset.key] = preset.value;
    }
  }

  for (const field of variant.fields) {
    const offered = offeredValue(supplied, field.key);

    if (
      !(ownedByEnvironment(field.key) || isSecretField(field.kind)) &&
      offered !== undefined
    ) {
      candidate[field.key] = offered;
    }
  }

  fillSecrets(
    candidate,
    variant,
    supplied,
    stored,
    ownedByEnvironment,
    keepsStoredSecrets
  );

  if (!isOffVariant(integration, variant)) {
    candidate[remembered] = variant.id;
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

export const conflictingPresetsOf = (
  integration: Integration,
  variant: IntegrationVariant,
  heldInEnvironment: HeldValue,
  ownedByEnvironment: OwnedByEnvironment
): ServerSettingKey[] => {
  const { discriminantKey } = integration;
  const discriminantConflicts =
    ownedByEnvironment(discriminantKey) &&
    (isOffVariant(integration, variant) ||
      (variant.discriminantValue !== null &&
        heldInEnvironment(discriminantKey) !== variant.discriminantValue));

  const presetConflicts = presetsOf(variant).flatMap((preset) =>
    ownedByEnvironment(preset.key) &&
    heldInEnvironment(preset.key) !== preset.value
      ? [preset.key]
      : []
  );

  return discriminantConflicts
    ? [discriminantKey, ...presetConflicts]
    : presetConflicts;
};

export const isWhollyOwnedByEnvironment = (
  integration: Integration,
  variant: IntegrationVariant,
  ownedByEnvironment: OwnedByEnvironment
): boolean =>
  ownedByEnvironment(integration.discriminantKey) &&
  variant.fields.every((field) => ownedByEnvironment(field.key)) &&
  presetsOf(variant).every((preset) => ownedByEnvironment(preset.key));

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

  const remembered = rememberedVariantKey(integration);

  writes.set(remembered, candidate[remembered] ?? null);

  return writes;
};

export const environmentVariantOf = (
  integration: Integration,
  stored: StoredSettings,
  heldInEnvironment: HeldValue,
  ownedByEnvironment: OwnedByEnvironment
): IntegrationVariant | null => {
  if (
    stored[integration.discriminantKey] !== undefined &&
    !ownedByEnvironment(integration.discriminantKey)
  ) {
    return null;
  }

  const inForce = Option.getOrNull(
    recogniseVariant(
      integration,
      heldInEnvironment,
      stored[rememberedVariantKey(integration)]
    )
  );

  if (inForce === null || isOffVariant(integration, inForce)) {
    return null;
  }

  const fullyOwned =
    inForce.fields.every(
      (field) => !field.required || ownedByEnvironment(field.key)
    ) && presetsOf(inForce).every((preset) => ownedByEnvironment(preset.key));

  return fullyOwned ? inForce : null;
};
