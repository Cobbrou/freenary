import { describe, expect, test } from "bun:test";

import { apiKeyFromHeaders, carriesApiKey } from "./api-key";

describe("apiKeyFromHeaders", () => {
  test.each([
    [{ "x-api-key": "fny_header" }, "fny_header"],
    [{ authorization: "Bearer fny_bearer" }, "fny_bearer"],
    [{ authorization: "bearer   fny_spaced  " }, "fny_spaced"],
    [
      { authorization: "Bearer fny_bearer", "x-api-key": "fny_header" },
      "fny_header",
    ],
  ])("reads the key from %o", (init, expected) => {
    expect(apiKeyFromHeaders(new Headers(init))).toBe(expected);
  });

  test.each([
    [{}],
    [{ authorization: "Basic dXNlcjpwYXNz" }],
    [{ authorization: "Bearer" }],
    [{ authorization: "Bearer two words" }],
    [{ "x-api-key": "   " }],
    [{ cookie: "better-auth.session_token=abc" }],
  ])("finds no key in %o", (init) => {
    expect(apiKeyFromHeaders(new Headers(init))).toBeNull();
    expect(carriesApiKey(new Headers(init))).toBe(false);
  });

  test("finds no key without headers", () => {
    expect(apiKeyFromHeaders(null)).toBeNull();
  });
});
