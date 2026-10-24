import { describe, expect, it } from "bun:test";

import {
  INTEGRATION_ROWS,
  integrationRowAction,
  integrationRowStatus,
  integrationRowStatusText,
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

const providerLabel = (variantId: string): string =>
  ({ jev: "Jev by TypeSafe", powens: "Powens" })[variantId] ?? variantId;

describe("integrationRowStatusText", () => {
  it("names the provider of a configured service", () => {
    expect(
      integrationRowStatusText(
        { kind: "configured", variantId: "powens" },
        providerLabel
      )
    ).toBe("Configured · Powens");
  });

  it("names the provider the server sets", () => {
    expect(
      integrationRowStatusText(
        { kind: "environment", variantId: "jev" },
        providerLabel
      )
    ).toBe("Set by your server · Jev by TypeSafe");
  });

  it("reads an off service and one missing a value in words", () => {
    expect(integrationRowStatusText({ kind: "disabled" }, providerLabel)).toBe(
      "Off"
    );

    expect(
      integrationRowStatusText({ kind: "incomplete" }, providerLabel)
    ).toBe("Needs setup");
  });
});

describe("integrationRowAction", () => {
  it("offers to change a configured service", () => {
    expect(
      integrationRowAction({ kind: "configured", variantId: "smtp" })
    ).toBe("change");
  });

  it("offers to set up a service that is off or needs setup", () => {
    expect(integrationRowAction({ kind: "disabled" })).toBe("set-up");
    expect(integrationRowAction({ kind: "incomplete" })).toBe("set-up");
  });

  it("offers to view a service the server sets", () => {
    expect(
      integrationRowAction({ kind: "environment", variantId: "powens" })
    ).toBe("view");
  });
});
