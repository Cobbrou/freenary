import { describe, expect, it } from "bun:test";

import { findIntegration } from "@freenary/instance-config/integrations";
import { Option } from "effect";

import type { CredentialField } from "./credential-steps";
import {
  credentialStepsOf,
  filledValuesOf,
  stepAfter,
  stepBefore,
  stepProblem,
} from "./credential-steps";

const field = (
  key: string,
  overrides: Partial<CredentialField> = {}
): CredentialField => ({
  key,
  kind: "text",
  present: false,
  required: true,
  source: "unset",
  suggestion: null,
  value: null,
  ...overrides,
});

const powensFields = [
  field("POWENS_DOMAIN"),
  field("POWENS_CLIENT_ID"),
  field("POWENS_CLIENT_SECRET", { kind: "secret" }),
];

const enableBankingFields = [
  field("ENABLE_BANKING_APP_ID"),
  field("ENABLE_BANKING_PRIVATE_KEY", { kind: "secret-block" }),
];

const fromEnvironment = { source: "environment" };

describe("credentialStepsOf", () => {
  it("asks Powens for the domain, the redirect URL, the client ID, then the secret", () => {
    expect(credentialStepsOf("powens", powensFields)).toEqual([
      { key: "POWENS_DOMAIN", kind: "field" },
      { kind: "redirect" },
      { key: "POWENS_CLIENT_ID", kind: "field" },
      { key: "POWENS_CLIENT_SECRET", kind: "field" },
    ]);
  });

  it("asks Enable Banking for the application ID, the redirect URL, then the private key", () => {
    expect(credentialStepsOf("enable-banking", enableBankingFields)).toEqual([
      { key: "ENABLE_BANKING_APP_ID", kind: "field" },
      { kind: "redirect" },
      { key: "ENABLE_BANKING_PRIVATE_KEY", kind: "field" },
    ]);
  });

  it("skips a field the environment sets and counts the rest", () => {
    const steps = credentialStepsOf("powens", [
      field("POWENS_DOMAIN", fromEnvironment),
      field("POWENS_CLIENT_ID"),
      field("POWENS_CLIENT_SECRET", { kind: "secret" }),
    ]);

    expect(steps).toEqual([
      { kind: "redirect" },
      { key: "POWENS_CLIENT_ID", kind: "field" },
      { key: "POWENS_CLIENT_SECRET", kind: "field" },
    ]);

    expect(steps).toHaveLength(3);
  });

  it("has no sequence when the environment sets every field", () => {
    expect(
      credentialStepsOf(
        "powens",
        powensFields.map((entry) => ({ ...entry, ...fromEnvironment }))
      )
    ).toBeNull();
  });

  it("has no sequence for a provider outside the bank", () => {
    expect(credentialStepsOf("smtp", [field("SMTP_HOST")])).toBeNull();
  });
});

describe("the bank sequences against the provider registry", () => {
  const banking = Option.getOrThrow(findIntegration("banking"));
  const withFields = banking.variants.filter(
    (variant) => variant.fields.length > 0
  );

  it.each(withFields.map((variant) => [variant.id, variant] as const))(
    "asks %s for exactly the fields the registry declares",
    (variantId, variant) => {
      const steps = credentialStepsOf(
        variantId,
        variant.fields.map((entry) => field(entry.key, { kind: entry.kind }))
      );

      expect(
        steps?.flatMap((step) => (step.kind === "field" ? [step.key] : []))
      ).toEqual(variant.fields.map((entry) => entry.key));
    }
  );
});

describe("stepProblem", () => {
  it("refuses an empty required field", () => {
    expect(stepProblem(field("POWENS_DOMAIN"), "")).toBe("empty");
    expect(stepProblem(field("POWENS_DOMAIN"), "   ")).toBe("empty");
  });

  it("applies the field's own rule", () => {
    expect(
      stepProblem(field("POWENS_DOMAIN"), "https://acme-sandbox.biapi.pro")
    ).toBe("domain-has-scheme");

    expect(stepProblem(field("POWENS_DOMAIN"), "acme-sandbox")).toBeNull();
  });

  it("lets an empty stored secret through, so it is kept", () => {
    expect(
      stepProblem(
        field("POWENS_CLIENT_SECRET", { kind: "secret", present: true }),
        ""
      )
    ).toBeNull();
  });

  it("refuses an empty secret that is not stored yet", () => {
    expect(
      stepProblem(field("POWENS_CLIENT_SECRET", { kind: "secret" }), "")
    ).toBe("empty");
  });

  it("lets an empty optional field through", () => {
    expect(stepProblem(field("SMTP_USER", { required: false }), "")).toBeNull();
  });
});

describe("stepAfter and stepBefore", () => {
  it("moves forward until the last step, which saves", () => {
    expect(stepAfter(0, 4)).toEqual({ index: 1, kind: "step" });
    expect(stepAfter(2, 4)).toEqual({ index: 3, kind: "step" });
    expect(stepAfter(3, 4)).toEqual({ kind: "save" });
  });

  it("moves back until the first step, which leaves for the provider choice", () => {
    expect(stepBefore(3)).toEqual({ index: 2, kind: "step" });
    expect(stepBefore(0)).toEqual({ kind: "leave" });
  });
});

describe("filledValuesOf", () => {
  it("starts from the stored values and leaves environment fields out", () => {
    expect(
      filledValuesOf([
        field("POWENS_DOMAIN", { value: "acme-sandbox" }),
        field("POWENS_CLIENT_ID", { ...fromEnvironment, value: "0000" }),
        field("POWENS_CLIENT_SECRET", { kind: "secret", present: true }),
      ])
    ).toEqual({ POWENS_DOMAIN: "acme-sandbox" });
  });
});
