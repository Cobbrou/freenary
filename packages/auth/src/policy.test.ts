import { describe, expect, test } from "bun:test";

import {
  getSchema,
  parseAdditionalUserInputFromProviderProfile,
  parseUserInput,
} from "better-auth/db";

import { betterAuthUserOf } from "./person-name";
import { USER_ADDITIONAL_FIELDS, USER_NAME_FIELDS } from "./policy";

const options = {
  user: { additionalFields: USER_ADDITIONAL_FIELDS, fields: USER_NAME_FIELDS },
};

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

  test.each(["create", "update"] as const)(
    "takes the last name from a request body (%s)",
    (action) => {
      expect(
        parseUserInput(options, { lastName: "Nouchet", name: "Marius" }, action)
      ).toEqual(expect.objectContaining({ lastName: "Nouchet" }));
    }
  );

  test("takes the last name a sign-in provider gives", () => {
    const { name: _name, ...profile } = betterAuthUserOf({
      family_name: "Nouchet",
      given_name: "Marius",
    });

    expect(
      parseAdditionalUserInputFromProviderProfile(options, profile, "create")
    ).toEqual({ lastName: "Nouchet" });
  });
});

describe("USER_NAME_FIELDS", () => {
  test("stores Better Auth's name in the firstName column", () => {
    expect(Object.keys(getSchema(options).user?.fields ?? {})).toEqual(
      expect.arrayContaining(["firstName", "lastName"])
    );

    expect(getSchema(options).user?.fields).not.toHaveProperty("name");
  });
});
