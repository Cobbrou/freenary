import { describe, expect, test } from "bun:test";

import { parseUserInput } from "better-auth/db";

import { USER_ADDITIONAL_FIELDS } from "./policy";

const options = { user: { additionalFields: USER_ADDITIONAL_FIELDS } };

describe("USER_ADDITIONAL_FIELDS", () => {
  test.each([
    ["update", { onboardingCompletedAt: "2026-01-01T00:00:00.000Z" }],
    ["update", { taxCountries: ["ZZ"] }],
    ["create", { onboardingCompletedAt: "2026-01-01T00:00:00.000Z" }],
    ["create", { taxCountries: ["ZZ"] }],
  ] as const)("refuses a request body that sets it (%s %o)", (action, body) => {
    expect(() => parseUserInput(options, body, action)).toThrow(
      expect.objectContaining({
        body: expect.objectContaining({ code: "FIELD_NOT_ALLOWED" }),
      })
    );
  });
});
