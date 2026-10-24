import { describe, expect, it } from "bun:test";

import {
  choosableVariants,
  initialChoiceOf,
  offersSkip,
  offersSkipButton,
} from "./variant-choice";

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

  it("leaves the disabled variant out of an optional integration", () => {
    expect(choosableIds(categories)).toEqual(["llm", "zero-shot"]);
  });
});

const assistant = {
  requiredForSetup: false,
  variants: [{ id: "disabled" }, { id: "openai-compatible" }],
};

describe("initialChoiceOf", () => {
  it("preselects the first provider while the integration is off", () => {
    expect(
      initialChoiceOf({ ...categories, selectedVariantId: "disabled" })
    ).toBe("llm");

    expect(
      initialChoiceOf({ ...assistant, selectedVariantId: "disabled" })
    ).toBe("openai-compatible");
  });

  it("keeps the provider in use", () => {
    expect(
      initialChoiceOf({ ...categories, selectedVariantId: "zero-shot" })
    ).toBe("zero-shot");
  });
});

describe("offersSkipButton", () => {
  it("offers a skip in setup whatever is selected", () => {
    expect(
      offersSkipButton({ ...categories, selectedVariantId: "disabled" }, true)
    ).toBe(true);
  });

  it("offers to turn off in Settings only an integration that is on", () => {
    expect(
      offersSkipButton({ ...categories, selectedVariantId: "llm" }, false)
    ).toBe(true);

    expect(
      offersSkipButton({ ...categories, selectedVariantId: "disabled" }, false)
    ).toBe(false);
  });

  it("never offers to skip or turn off an integration setup requires", () => {
    expect(
      offersSkipButton({ ...bank, selectedVariantId: "powens" }, false)
    ).toBe(false);

    expect(
      offersSkipButton({ ...bank, selectedVariantId: "powens" }, true)
    ).toBe(false);
  });
});
