import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";

import { startTestDatabase } from "@freenary/db/testing";
import { env } from "@freenary/env/server";
import { betterAuth } from "better-auth";
import {
  getSchema,
  parseAdditionalUserInputFromProviderProfile,
  parseUserInput,
} from "better-auth/db";
import { emailOTP, testUtils } from "better-auth/plugins";

import { auth } from "./index";
import { betterAuthUserOf } from "./person-name";
import {
  OTP_ISSUING_PATH,
  REAUTH_WINDOW_SECONDS,
  USER_ADDITIONAL_FIELDS,
  USER_NAME_FIELDS,
} from "./policy";

const SIGNED_IN_AT = new Date("2026-10-01T08:00:00.000Z");
const REAUTH_WINDOW_MS = REAUTH_WINDOW_SECONDS * 1000;
const EMAIL = "policy@example.test";

const AUTH_URL = `${auth.options.baseURL}/api/auth`;

const REAUTHENTICATED_PATHS = [
  "/api-key/create",
  "/link-social",
  "/passkey/delete-passkey",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/unlink-account",
];

const policyAuth = betterAuth({
  ...auth.options,
  plugins: [
    ...auth.options.plugins.filter(({ id }) => id !== "email-otp"),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: () => Promise.resolve(),
    }),
    testUtils(),
  ],
});

let userId: string;

const methodOf = (path: string): string => {
  const endpoint = Object.values(policyAuth.api).find(
    (candidate) => candidate.path === path
  );

  if (endpoint === undefined) {
    throw new TypeError(`Better Auth has no endpoint at ${path}`);
  }

  return String(endpoint.options.method);
};

const answerOf = async (
  path: string,
  body: Record<string, string> = {},
  headers = new Headers()
) => {
  const method = methodOf(path);

  headers.set("content-type", "application/json");
  headers.set("origin", env.CORS_ORIGIN);

  const response = await policyAuth.handler(
    new Request(`${AUTH_URL}${path}`, {
      body: method === "GET" ? undefined : JSON.stringify(body),
      headers,
      method,
    })
  );

  const { code } = JSON.parse((await response.text()) || "{}");

  return { code, status: response.status };
};

const createVerifiedUser = async (): Promise<string> => {
  const { test: helpers } = await policyAuth.$context;
  const user = await helpers.saveUser(
    helpers.createUser({ email: EMAIL, emailVerified: true })
  );

  return user.id;
};

const sessionHeaders = async (): Promise<Headers> => {
  const { test: helpers } = await policyAuth.$context;

  return await helpers.getAuthHeaders({ userId });
};

beforeAll(async () => {
  await startTestDatabase();
});

beforeEach(async () => {
  userId = await createVerifiedUser();
});

afterEach(async () => {
  const { test: helpers } = await policyAuth.$context;

  setSystemTime();
  await helpers.deleteUser(userId);
});

describe("DISABLED_PATHS", () => {
  test("hides the sign-in with a one-time code", async () => {
    expect(
      await answerOf("/sign-in/email-otp", { email: EMAIL, otp: "000000" })
    ).toEqual({ code: "NOT_FOUND", status: 404 });
  });
});

describe("one-time codes", () => {
  test("are not issued to sign in", async () => {
    expect(
      await answerOf(OTP_ISSUING_PATH, { email: EMAIL, type: "sign-in" })
    ).toEqual({ code: "INVALID_OTP_TYPE", status: 400 });
  });

  test("are issued to verify an address", async () => {
    expect(
      await answerOf(OTP_ISSUING_PATH, {
        email: EMAIL,
        type: "email-verification",
      })
    ).toEqual({ code: undefined, status: 200 });
  });

  test("do not verify an address twice", async () => {
    const otp = await policyAuth.api.createVerificationOTP({
      body: { email: EMAIL, type: "email-verification" },
    });

    expect(
      await answerOf("/email-otp/verify-email", { email: EMAIL, otp })
    ).toEqual({ code: "INVALID_OTP", status: 400 });
  });
});

describe("REAUTH_PATHS", () => {
  test.each(REAUTHENTICATED_PATHS)(
    "refuses a session as old as the window on %s",
    async (path) => {
      setSystemTime(SIGNED_IN_AT);

      const headers = await sessionHeaders();

      setSystemTime(new Date(SIGNED_IN_AT.getTime() + REAUTH_WINDOW_MS));

      expect(await answerOf(path, {}, headers)).toEqual({
        code: "SESSION_NOT_FRESH",
        status: 403,
      });
    }
  );

  test.each(REAUTHENTICATED_PATHS)(
    "lets a session one millisecond younger through on %s",
    async (path) => {
      setSystemTime(SIGNED_IN_AT);

      const headers = await sessionHeaders();

      setSystemTime(new Date(SIGNED_IN_AT.getTime() + REAUTH_WINDOW_MS - 1));

      const { code, status } = await answerOf(path, {}, headers);

      expect(code).not.toBe("SESSION_NOT_FRESH");
      expect(status).not.toBe(401);
    }
  );

  test.each(REAUTHENTICATED_PATHS)("refuses a guest on %s", async (path) => {
    expect(await answerOf(path)).toEqual({ code: "UNAUTHORIZED", status: 401 });
  });
});

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
