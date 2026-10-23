import { describe, expect, it } from "bun:test";

import {
  INTEGRATION_ROWS,
  integrationRowStatus,
  integrationRowsOf,
} from "./integration-rows";

const integration = (
  id: string,
  overrides: Partial<{
    configuredBy: string | null;
    selectedVariantId: string;
    state: string;
  }> = {}
) => ({
  configuredBy: null,
  id,
  selectedVariantId: "disabled",
  state: "disabled",
  ...overrides,
});

const described = [
  integration("banking"),
  integration("email"),
  integration("assistant"),
  integration("categorisation"),
];

describe("integrationRowsOf", () => {
  it("lists the Bank provider first, then Categories, Email delivery and the Assistant model", () => {
    expect(
      integrationRowsOf(INTEGRATION_ROWS, described).map(({ row }) => row.id)
    ).toEqual(["banking", "categorisation", "email", "assistant"]);
  });

  it("pairs each row with its described integration", () => {
    const [first] = integrationRowsOf(INTEGRATION_ROWS, described);

    expect(first?.integration?.id).toBe("banking");
  });

  it("keeps every row, with no integration, while the description loads", () => {
    const loading: { data?: { integrations: typeof described } } = {};
    const rows = integrationRowsOf(
      INTEGRATION_ROWS,
      loading.data?.integrations
    );

    expect(rows.map(({ row }) => row.id)).toEqual([
      "banking",
      "categorisation",
      "email",
      "assistant",
    ]);

    expect(rows.every((entry) => entry.integration === undefined)).toBe(true);
  });

  it("drops a row the server does not describe", () => {
    expect(
      integrationRowsOf(INTEGRATION_ROWS, [integration("email")]).map(
        ({ row }) => row.id
      )
    ).toEqual(["email"]);
  });
});

describe("integrationRowStatus", () => {
  it("names the provider of a configured integration", () => {
    expect(
      integrationRowStatus(
        integration("email", {
          configuredBy: "instance",
          selectedVariantId: "smtp",
          state: "configured",
        })
      )
    ).toEqual({ kind: "configured", variantId: "smtp" });
  });

  it("reads an integration the environment owns as set by the server", () => {
    expect(
      integrationRowStatus(
        integration("assistant", {
          configuredBy: "environment",
          selectedVariantId: "openai-compatible",
          state: "configured",
        })
      )
    ).toEqual({ kind: "environment", variantId: "openai-compatible" });
  });

  it("reads a mock bank the environment sets as set by the server", () => {
    expect(
      integrationRowStatus(
        integration("banking", {
          configuredBy: "environment",
          selectedVariantId: "mock",
          state: "configured",
        })
      )
    ).toEqual({ kind: "environment", variantId: "mock" });
  });

  it("reads a disabled integration as off", () => {
    expect(integrationRowStatus(integration("categorisation"))).toEqual({
      kind: "disabled",
    });
  });

  it("reads a provider with missing fields as incomplete", () => {
    expect(
      integrationRowStatus(
        integration("email", {
          configuredBy: "instance",
          selectedVariantId: "resend",
          state: "incomplete",
        })
      )
    ).toEqual({ kind: "incomplete" });
  });
});
