import type {
  Integration,
  ServerSettingKey,
} from "@freenary/instance-config/integrations";
import { findVariant } from "@freenary/instance-config/integrations";
import { Option } from "effect";

export const DISABLED_VARIANT = "disabled";

export type IntegrationState = "configured" | "disabled" | "incomplete";

export const integrationStateOf = (
  integration: Integration,
  selectedVariantId: string,
  isHeld: (key: ServerSettingKey) => boolean
): IntegrationState => {
  if (selectedVariantId === DISABLED_VARIANT) {
    return "disabled";
  }

  return Option.match(findVariant(integration, selectedVariantId), {
    onNone: () => "incomplete",
    onSome: (variant) =>
      variant.fields.every((field) => !field.required || isHeld(field.key))
        ? "configured"
        : "incomplete",
  });
};

export interface SetupStanding {
  readonly id: string;
  readonly requiredForSetup: boolean;
  readonly state: IntegrationState;
}

export const missingForSetup = (
  standings: readonly SetupStanding[]
): string[] =>
  standings.flatMap((standing) =>
    standing.requiredForSetup && standing.state !== "configured"
      ? [standing.id]
      : []
  );
