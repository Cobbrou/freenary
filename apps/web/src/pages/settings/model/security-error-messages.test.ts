import { beforeAll, describe, expect, it } from "bun:test";

import { m } from "@/paraglide/messages.js";
import { overwriteGetLocale } from "@/paraglide/runtime.js";

import { apiKeyErrorMessage } from "./security-error-messages";

beforeAll(() => {
  overwriteGetLocale(() => "en");
});

describe("apiKeyErrorMessage", () => {
  it("asks to sign in again when the session is not fresh", () => {
    expect(apiKeyErrorMessage({ code: "SESSION_NOT_FRESH", status: 403 })).toBe(
      m.settings_accounts_error_session_not_fresh()
    );
  });

  it("reports rate limiting before reading the code", () => {
    expect(apiKeyErrorMessage({ code: "KEY_NOT_FOUND", status: 429 })).toBe(
      m.auth_error_rate_limited()
    );
  });

  it("explains a key that no longer exists", () => {
    expect(apiKeyErrorMessage({ code: "KEY_NOT_FOUND", status: 404 })).toBe(
      m.settings_api_keys_error_not_found()
    );
  });

  it("explains a refused name", () => {
    expect(apiKeyErrorMessage({ code: "NAME_REQUIRED" })).toBe(
      m.settings_api_keys_error_name()
    );

    expect(apiKeyErrorMessage({ code: "INVALID_NAME_LENGTH" })).toBe(
      m.settings_api_keys_error_name()
    );
  });

  it("falls back to a generic message", () => {
    expect(apiKeyErrorMessage({ code: "SOMETHING_ELSE" })).toBe(
      m.settings_api_keys_error_generic()
    );

    expect(apiKeyErrorMessage({})).toBe(m.settings_api_keys_error_generic());
  });
});
