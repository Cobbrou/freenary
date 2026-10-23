import { describe, expect, it } from "bun:test";

import { choosableVariants, offersSkip } from "./variant-choice";

const bank = {
  requiredForSetup: true,
  variants: [{ id: "disabled" }, { id: "powens" }, { id: "enable-banking" }],
};

const categories = {
  requiredForSetup: false,
  variants: [{ id: "disabled" }, { id: "llm" }, { id: "zero-shot" }],
};

const choosableIds = (integration: typeof bank): string[] =>
  choosableVariants(integration).map((variant) => variant.id);

describe("offersSkip", () => {
  it("offers no skip for an integration setup requires", () => {
    expect(offersSkip(bank)).toBe(false);
  });

  it("offers a skip for an optional integration", () => {
    expect(offersSkip(categories)).toBe(true);
  });

  it("offers no skip when the integration has no disabled variant", () => {
    expect(
      offersSkip({ requiredForSetup: false, variants: [{ id: "llm" }] })
    ).toBe(false);
  });
});

describe("choosableVariants", () => {
  it("leaves the disabled variant out of a required integration", () => {
    expect(choosableIds(bank)).toEqual(["powens", "enable-banking"]);
  });

  it("keeps the disabled variant of an optional integration", () => {
    expect(choosableIds(categories)).toEqual(["disabled", "llm", "zero-shot"]);
  });
});
