import { describe, expect, it } from "bun:test";

import { m } from "@/paraglide/messages.js";

import { variantLabel } from "./labels";

describe("variantLabel", () => {
  it("names the mock bank as development only", () => {
    expect(variantLabel("mock")).toBe("Mock bank (development only)");
    expect(m.setup_variant_mock({}, { locale: "fr" })).toBe(
      "Banque fictive (développement uniquement)"
    );
  });

  it("reads a mock bank the environment sets as set by the server", () => {
    expect(
      m.settings_integrations_state_environment({
        provider: variantLabel("mock"),
      })
    ).toBe("Set by your server · Mock bank (development only)");
  });
});
