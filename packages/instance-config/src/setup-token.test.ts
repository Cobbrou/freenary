import { describe, expect, test } from "bun:test";

import { isSetupToken, setupTokenOf } from "./setup-token";

const SECRET = "a-secret-that-is-at-least-32-characters";
const OTHER_SECRET = "another-secret-of-at-least-32-characters";

describe("setup token", () => {
  test("accepts the token of the instance's secret", () => {
    expect(isSetupToken(SECRET, setupTokenOf(SECRET))).toBe(true);
  });

  test("accepts the token with the whitespace a paste carries", () => {
    expect(isSetupToken(SECRET, ` ${setupTokenOf(SECRET)}\n`)).toBe(true);
  });

  test("refuses a claim without a token", () => {
    expect(isSetupToken(SECRET, "")).toBe(false);
  });

  test("refuses the token of another secret", () => {
    expect(isSetupToken(SECRET, setupTokenOf(OTHER_SECRET))).toBe(false);
  });

  test("gives the same token on every start", () => {
    expect(setupTokenOf(SECRET)).toBe(setupTokenOf(SECRET));
  });

  test("does not reveal the secret", () => {
    expect(setupTokenOf(SECRET)).not.toContain(SECRET);
  });
});
