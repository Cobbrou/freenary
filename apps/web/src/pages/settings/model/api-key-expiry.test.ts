import { describe, expect, it } from "bun:test";

import {
  API_KEY_EXPIRY_CHOICES,
  expiresInSecondsOf,
  isApiKeyExpiryChoice,
} from "./api-key-expiry";

const ONE_DAY_SECONDS = 86_400;
const MAX_EXPIRY_SECONDS = 365 * ONE_DAY_SECONDS;

describe("expiresInSecondsOf", () => {
  it("omits the expiry for a key that never expires", () => {
    expect(expiresInSecondsOf("never")).toBeUndefined();
  });

  it("turns each period into seconds", () => {
    expect(expiresInSecondsOf("30d")).toBe(2_592_000);
    expect(expiresInSecondsOf("90d")).toBe(7_776_000);
    expect(expiresInSecondsOf("1y")).toBe(31_536_000);
  });

  it("stays within the range the server accepts", () => {
    for (const choice of API_KEY_EXPIRY_CHOICES) {
      const seconds = expiresInSecondsOf(choice);

      if (seconds !== undefined) {
        expect(seconds).toBeGreaterThanOrEqual(ONE_DAY_SECONDS);
        expect(seconds).toBeLessThanOrEqual(MAX_EXPIRY_SECONDS);
      }
    }
  });
});

describe("isApiKeyExpiryChoice", () => {
  it("accepts the listed choices only", () => {
    expect(isApiKeyExpiryChoice("90d")).toBe(true);
    expect(isApiKeyExpiryChoice("7d")).toBe(false);
    expect(isApiKeyExpiryChoice("toString")).toBe(false);
  });
});
