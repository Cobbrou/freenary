import { describe, expect, it } from "bun:test";

import { setupIntegrationsOf, setupStepsOf } from "./setup-steps";

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
