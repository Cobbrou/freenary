import { describe, expect, test } from "bun:test";

import { admitsClaim, visibleSetupStatus } from "./claim";

const TOKEN = "a-setup-token-of-some-length";
const UNCLAIMED = { claimed: false, completed: false };

describe("admitsClaim", () => {
  test("admits any answer when no token is configured", () => {
    expect(admitsClaim(undefined, "")).toBe(true);
  });

  test("admits the configured token", () => {
    expect(admitsClaim(TOKEN, TOKEN)).toBe(true);
  });

  test("admits the token with the whitespace a paste carries", () => {
    expect(admitsClaim(TOKEN, ` ${TOKEN}\n`)).toBe(true);
  });

  test("refuses an empty answer when a token is configured", () => {
    expect(admitsClaim(TOKEN, "")).toBe(false);
  });

  test("refuses another value", () => {
    expect(admitsClaim(TOKEN, `${TOKEN}x`)).toBe(false);
  });
});

describe("visibleSetupStatus", () => {
  test("tells a guest nothing about the claim", () => {
    expect(visibleSetupStatus(UNCLAIMED, null, true)).toEqual({
      claimed: null,
      completed: false,
      isOperator: false,
      setupTokenRequired: null,
    });
  });

  test("tells a signed-in account whether the claim needs a token", () => {
    expect(visibleSetupStatus(UNCLAIMED, { isOperator: false }, true)).toEqual({
      claimed: false,
      completed: false,
      isOperator: false,
      setupTokenRequired: true,
    });
  });
});
