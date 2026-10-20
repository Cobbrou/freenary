import { describe, expect, it } from "bun:test";

import { Option } from "effect";

import { mockSessionCode, openedOnOf } from "./session";

describe("mock session code", () => {
  it("carries the day the consent was given", () => {
    const code = mockSessionCode(new Date("2026-10-20T15:00:00Z"));

    expect(openedOnOf(code)).toEqual(Option.some("2026-10-20"));
  });

  it("refuses a code without the mock prefix", () => {
    expect(
      Option.isNone(
        openedOnOf("bank_2026-10-20_0f8b6c1e-2d4a-4b7e-9c3f-5a6b7c8d9e0f")
      )
    ).toBe(true);
  });

  it("refuses a code with no consent day", () => {
    expect(
      Option.isNone(openedOnOf("mock_0f8b6c1e-2d4a-4b7e-9c3f-5a6b7c8d9e0f"))
    ).toBe(true);
  });
});
