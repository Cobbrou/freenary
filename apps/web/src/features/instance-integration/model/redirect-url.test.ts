import { describe, expect, it } from "bun:test";

import { providerRedirectUrl } from "./redirect-url";

describe("providerRedirectUrl", () => {
  it("appends the provider's callback path to the origin", () => {
    expect(providerRedirectUrl("https://freenary.example.com", "powens")).toBe(
      "https://freenary.example.com/callback/powens"
    );
  });

  it("does not double a trailing slash", () => {
    expect(providerRedirectUrl("https://freenary.example.com/", "powens")).toBe(
      "https://freenary.example.com/callback/powens"
    );
  });
});
