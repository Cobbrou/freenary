import { describe, expect, it } from "bun:test";

import { Result } from "effect";

import { openStoredToken, sealToken, tokenSealKey } from "./bank-provider-user";

const SECRET = "test-secret-at-least-32-characters-long";
const KEY = tokenSealKey("powens", "user-1");

describe("openStoredToken", () => {
  it("opens a sealed token", () => {
    const stored = sealToken(SECRET, KEY, "powens-token");

    expect(stored).not.toContain("powens-token");
    expect(Result.getOrThrow(openStoredToken(SECRET, KEY, stored))).toEqual({
      isLegacyPlaintext: false,
      token: "powens-token",
    });
  });

  it("returns a legacy plain token so it can be sealed", () => {
    expect(
      Result.getOrThrow(openStoredToken(SECRET, KEY, "plain_Token-123"))
    ).toEqual({ isLegacyPlaintext: true, token: "plain_Token-123" });
  });

  it("treats a plain token shaped like a sealed body as legacy", () => {
    const shaped = `${"a".repeat(16)}.${"b".repeat(22)}.c`;

    expect(
      Result.getOrThrow(openStoredToken(SECRET, KEY, shaped)).isLegacyPlaintext
    ).toBe(true);
  });

  it("refuses a sealed token of another user", () => {
    const stored = sealToken(SECRET, tokenSealKey("powens", "user-2"), "token");

    expect(Result.isFailure(openStoredToken(SECRET, KEY, stored))).toBe(true);
  });

  it("refuses a sealed token under another secret", () => {
    const stored = sealToken(SECRET, KEY, "token");

    expect(
      Result.isFailure(
        openStoredToken("another-secret-of-at-least-32-chars", KEY, stored)
      )
    ).toBe(true);
  });
});
