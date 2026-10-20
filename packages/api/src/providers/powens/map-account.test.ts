import { describe, expect, test } from "bun:test";

import { mapPowensAccount } from "./map-account";

describe("mapPowensAccount", () => {
  test("reads the type whether the provider sends a string or an object", () => {
    expect(mapPowensAccount({ id: 1, type: "checking" }).type).toBe("CHECKING");
    expect(mapPowensAccount({ id: 1, type: { name: "checking" } }).type).toBe(
      "CHECKING"
    );
  });

  test("groups the French account kinds onto the core's types", () => {
    expect(mapPowensAccount({ id: 1, type: "pea" }).type).toBe("BROKERAGE");
    expect(mapPowensAccount({ id: 1, type: "livret_a" }).type).toBe("SAVINGS");
    expect(mapPowensAccount({ id: 1, type: "lifeinsurance" }).type).toBe(
      "LIFE_INSURANCE"
    );
  });

  test("falls back to UNKNOWN for a type it does not know", () => {
    expect(mapPowensAccount({ id: 1, type: "joint" }).type).toBe("UNKNOWN");
    expect(mapPowensAccount({ id: 1, type: "unknown" }).type).toBe("UNKNOWN");
    expect(mapPowensAccount({ id: 1 }).type).toBe("UNKNOWN");
  });

  test("converts the balance with the currency's precision", () => {
    const account = mapPowensAccount({
      balance: 12.3,
      currency: { id: "EUR", precision: 2 },
      id: 42,
    });

    expect(account.balanceMinor).toBe(1230);
    expect(account.currency).toBe("EUR");
    expect(account.providerAccountId).toBe("42");
  });

  test("leaves the balance out when the provider reports none", () => {
    expect(
      mapPowensAccount({ balance: null, id: 1 }).balanceMinor
    ).toBeUndefined();
  });

  test("reads the balance date as UTC", () => {
    expect(
      mapPowensAccount({ id: 1, last_update: "2026-03-04 09:15:30" }).balanceAt
    ).toBe("2026-03-04T09:15:30Z");

    expect(
      mapPowensAccount({ id: 1, last_update: null }).balanceAt
    ).toBeUndefined();
  });

  test("falls back to the original name", () => {
    expect(
      mapPowensAccount({ id: 1, name: null, original_name: "CCP 0001" }).name
    ).toBe("CCP 0001");
  });
});
