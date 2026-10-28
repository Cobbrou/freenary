import { describe, expect, test } from "bun:test";

import type { ProviderInstitution } from "../providers/types";
import {
  encodeBankConnectionState,
  findInstitution,
  parseBankConnectionState,
  verifyBankConnectionState,
} from "./bank-connection-state";

const institution: ProviderInstitution = {
  country: "FR",
  id: "bank-id",
  name: "Canonical Bank",
};

describe("bank connection state", () => {
  const userId = "user-123";
  const secret = "test-secret-at-least-32-characters-long";

  test("encodes canonical institution data and preserves original state", () => {
    const state = parseBankConnectionState(
      encodeBankConnectionState({
        institution,
        original: "csrf-state",
        providerId: "enable-banking",
        returnTo: "settings",
        secret,
        userId,
      })
    );

    expect(state).toMatchObject({
      institution,
      original: "csrf-state",
      providerId: "enable-banking",
      returnTo: "settings",
    });

    expect(state.hmac).toBeString();
  });

  test("HMAC verifies for the same user", () => {
    const encoded = encodeBankConnectionState({
      institution,
      providerId: "enable-banking",
      returnTo: "onboarding",
      secret,
      userId,
    });

    const state = parseBankConnectionState(encoded);

    expect(verifyBankConnectionState(state, userId, secret)).toBe(true);
  });

  test("HMAC rejects a different user", () => {
    const encoded = encodeBankConnectionState({
      institution,
      providerId: "enable-banking",
      returnTo: "onboarding",
      secret,
      userId,
    });

    const state = parseBankConnectionState(encoded);

    expect(verifyBankConnectionState(state, "other-user", secret)).toBe(false);
  });

  test("HMAC rejects a tampered return target", () => {
    const state = parseBankConnectionState(
      encodeBankConnectionState({
        institution,
        providerId: "enable-banking",
        returnTo: "onboarding",
        secret,
        userId,
      })
    );

    expect(
      verifyBankConnectionState(
        { ...state, returnTo: "settings" },
        userId,
        secret
      )
    ).toBe(false);
  });

  test("rejects state without a return target", () => {
    expect(() =>
      parseBankConnectionState(
        JSON.stringify({
          hmac: "deadbeef",
          institution,
          providerId: "enable-banking",
        })
      )
    ).toThrow();
  });

  test("only resolves an institution for the canonical id and country", () => {
    expect(findInstitution([institution], "bank-id", "FR")).toEqual(
      institution
    );

    expect(findInstitution([institution], "bank-id", "DE")).toBeUndefined();
    expect(findInstitution([institution], "other-bank", "FR")).toBeUndefined();
  });

  test("rejects legacy display-name-only state", () => {
    expect(() =>
      parseBankConnectionState('{"bankName":"Untrusted"}')
    ).toThrow();
  });
});
