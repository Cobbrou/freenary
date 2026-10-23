import { describe, expect, test } from "bun:test";

import type {
  Integration,
  ServerSettingKey,
} from "@freenary/instance-config/integrations";
import {
  findIntegration,
  integrations,
  isRequiredForSetup,
} from "@freenary/instance-config/integrations";
import { Option } from "effect";

import { environmentVariantOf } from "./merge";
import type { IntegrationState } from "./setup";
import { integrationStateOf, missingForSetup } from "./setup";

const banking: Integration = Option.getOrThrow(findIntegration("banking"));

const categorisation: Integration = Option.getOrThrow(
  findIntegration("categorisation")
);

const holding =
  (...keys: ServerSettingKey[]) =>
  (key: ServerSettingKey): boolean =>
    keys.includes(key);

const standingsWith = (states: Readonly<Record<string, IntegrationState>>) =>
  integrations.map((integration) => ({
    id: integration.id,
    requiredForSetup: isRequiredForSetup(integration),
    state: states[integration.id] ?? "disabled",
  }));

const POWENS_KEYS = [
  "POWENS_DOMAIN",
  "POWENS_CLIENT_ID",
  "POWENS_CLIENT_SECRET",
] as const;

describe("integrationStateOf", () => {
  test("reads the disabled variant as disabled", () => {
    expect(integrationStateOf(banking, "disabled", holding())).toBe("disabled");
  });

  test("reads a provider with a required field unset as incomplete", () => {
    expect(
      integrationStateOf(
        banking,
        "powens",
        holding("POWENS_DOMAIN", "POWENS_CLIENT_ID")
      )
    ).toBe("incomplete");
  });

  test("reads a provider with every required field held as configured", () => {
    expect(integrationStateOf(banking, "powens", holding(...POWENS_KEYS))).toBe(
      "configured"
    );
  });

  test("reads an unknown variant as incomplete", () => {
    expect(integrationStateOf(banking, "nowhere", holding())).toBe(
      "incomplete"
    );
  });
});

describe("missingForSetup", () => {
  test("refuses while no bank provider is chosen", () => {
    expect(missingForSetup(standingsWith({}))).toEqual(["banking"]);
  });

  test("refuses while the bank provider lacks a required field", () => {
    const state = integrationStateOf(
      banking,
      "powens",
      holding("POWENS_DOMAIN")
    );

    expect(missingForSetup(standingsWith({ banking: state }))).toEqual([
      "banking",
    ]);
  });

  test("allows a configured bank with categorisation switched off", () => {
    const state = integrationStateOf(
      banking,
      "powens",
      holding(...POWENS_KEYS)
    );

    expect(
      missingForSetup(
        standingsWith({ banking: state, categorisation: "disabled" })
      )
    ).toEqual([]);
  });

  test("allows a bank provider the environment configures", () => {
    const environmentVariant = environmentVariantOf(
      banking,
      {},
      (key) => (key === "BANKING_PROVIDER" ? "mock" : undefined),
      holding("BANKING_PROVIDER")
    );

    expect(environmentVariant?.id).toBe("mock");

    const state = integrationStateOf(
      banking,
      environmentVariant?.id ?? "disabled",
      holding("BANKING_PROVIDER")
    );

    expect(missingForSetup(standingsWith({ banking: state }))).toEqual([]);
  });

  test("ignores an incomplete integration setup does not require", () => {
    const state = integrationStateOf(categorisation, "llm", holding());

    expect(
      missingForSetup(
        standingsWith({ banking: "configured", categorisation: state })
      )
    ).toEqual([]);
  });
});
