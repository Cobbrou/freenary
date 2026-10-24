import type { FieldProblem } from "./field-rules";
import { fieldProblem } from "./field-rules";

const ENVIRONMENT_SOURCE = "environment";

export type CredentialStep =
  | { readonly key: string; readonly kind: "field" }
  | { readonly kind: "redirect" };

export interface CredentialField {
  readonly key: string;
  readonly kind: string;
  readonly present: boolean;
  readonly required: boolean;
  readonly source: string;
  readonly suggestion: string | null;
  readonly value: string | null;
}

const fieldStep = (key: string): CredentialStep => ({ key, kind: "field" });

const REDIRECT_STEP: CredentialStep = { kind: "redirect" };

const SEQUENCES: Readonly<Record<string, readonly CredentialStep[]>> = {
  "enable-banking": [
    fieldStep("ENABLE_BANKING_APP_ID"),
    REDIRECT_STEP,
    fieldStep("ENABLE_BANKING_PRIVATE_KEY"),
  ],
  powens: [
    fieldStep("POWENS_DOMAIN"),
    REDIRECT_STEP,
    fieldStep("POWENS_CLIENT_ID"),
    fieldStep("POWENS_CLIENT_SECRET"),
  ],
};

export const isFromServer = (field: CredentialField): boolean =>
  field.source === ENVIRONMENT_SOURCE;

const isSecret = (field: CredentialField): boolean =>
  field.kind === "secret" || field.kind === "secret-block";

export const credentialStepsOf = (
  variantId: string,
  fields: readonly CredentialField[]
): CredentialStep[] | null => {
  const sequence = SEQUENCES[variantId];

  if (sequence === undefined) {
    return null;
  }

  const asked = new Set(
    fields.flatMap((field) => (isFromServer(field) ? [] : [field.key]))
  );

  const steps = sequence.filter(
    (step) => step.kind === "redirect" || asked.has(step.key)
  );

  return steps.some((step) => step.kind === "field") ? steps : null;
};

export const filledValuesOf = (
  fields: readonly CredentialField[]
): Record<string, string> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const starting = field.value ?? field.suggestion;

      return starting === null || isFromServer(field)
        ? []
        : [[field.key, starting]];
    })
  );

export const stepProblem = (
  field: CredentialField,
  value: string
): FieldProblem | null => {
  if (value.trim() !== "") {
    return fieldProblem(field.key, value);
  }

  const keepsStoredSecret = isSecret(field) && field.present;

  return field.required && !keepsStoredSecret ? "empty" : null;
};

export type StepMove =
  | { readonly index: number; readonly kind: "step" }
  | { readonly kind: "leave" }
  | { readonly kind: "save" };

export const stepAfter = (index: number, count: number): StepMove =>
  index + 1 < count ? { index: index + 1, kind: "step" } : { kind: "save" };

export const stepBefore = (index: number): StepMove =>
  index > 0 ? { index: index - 1, kind: "step" } : { kind: "leave" };
