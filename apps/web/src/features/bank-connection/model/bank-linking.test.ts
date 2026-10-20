import { describe, expect, it } from "bun:test";

import { bankLinkingOf } from "./bank-linking";

describe("bankLinkingOf", () => {
  it("is pending until the provider check answers", () => {
    expect(bankLinkingOf({ available: undefined, isError: false })).toBe(
      "pending"
    );
  });

  it("reports a check that failed before any answer", () => {
    expect(bankLinkingOf({ available: undefined, isError: true })).toBe(
      "check-failed"
    );
  });

  it("keeps the last answer when a later check fails", () => {
    expect(bankLinkingOf({ available: true, isError: true })).toBe("available");
  });

  it("reports an instance with no bank provider", () => {
    expect(bankLinkingOf({ available: false, isError: false })).toBe(
      "unavailable"
    );
  });
});
