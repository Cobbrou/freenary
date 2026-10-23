import { describe, expect, it } from "bun:test";

import { ORPCError } from "@orpc/client";

import {
  completionFailureOf,
  setupIntegrationsOf,
  setupStepsOf,
} from "./setup-steps";

const described = [
  { id: "banking", shownInSetup: true },
  { id: "email", shownInSetup: false },
  { id: "assistant", shownInSetup: false },
  { id: "categorisation", shownInSetup: true },
];

describe("setupStepsOf", () => {
  it("shows Bank, then Categories, then Done", () => {
    expect(setupStepsOf(described)).toEqual([
      "banking",
      "categorisation",
      "finish",
    ]);
  });

  it("still ends on Done when nothing is shown", () => {
    expect(setupStepsOf([])).toEqual(["finish"]);
  });
});

describe("setupIntegrationsOf", () => {
  it("keeps only the integrations the setup shows, in order", () => {
    expect(
      setupIntegrationsOf(described).map((integration) => integration.id)
    ).toEqual(["banking", "categorisation"]);
  });
});

describe("completionFailureOf", () => {
  it("reads a refusal that names the bank as a missing bank", () => {
    const refusal = new ORPCError("PRECONDITION_FAILED", {
      data: { missing: ["banking"] },
    });

    expect(completionFailureOf(refusal)).toBe("needs-bank");
  });

  it("reads a refusal without the bank as a plain failure", () => {
    const refusal = new ORPCError("PRECONDITION_FAILED", {
      data: { missing: [] },
    });

    expect(completionFailureOf(refusal)).toBe("failed");
  });

  it("reads another server error as a plain failure", () => {
    expect(completionFailureOf(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(
      "failed"
    );
  });

  it("reads a network error as a plain failure", () => {
    expect(completionFailureOf(new TypeError("Failed to fetch"))).toBe(
      "failed"
    );
  });
});
