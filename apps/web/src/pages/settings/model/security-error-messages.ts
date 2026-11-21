import { m } from "@/paraglide/messages.js";

export interface SecurityRequestError {
  code?: string;
  status?: number;
}

const TOO_MANY_REQUESTS = 429;

const TWO_FACTOR_MESSAGES = {
  CREDENTIAL_ACCOUNT_NOT_FOUND: m.settings_2fa_error_no_password,
  INVALID_BACKUP_CODE: m.settings_2fa_error_invalid_code,
  INVALID_CODE: m.settings_2fa_error_invalid_code,
  INVALID_PASSWORD: m.settings_2fa_error_wrong_password,
} satisfies Record<string, () => string>;

const LINKED_ACCOUNT_MESSAGES = {
  FAILED_TO_UNLINK_LAST_ACCOUNT: m.settings_accounts_error_last_account,
  SESSION_NOT_FRESH: m.settings_accounts_error_session_not_fresh,
} satisfies Record<string, () => string>;

const PASSKEY_MESSAGES = {
  CHALLENGE_NOT_FOUND: m.settings_passkeys_error_challenge,
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED:
    m.settings_passkeys_error_already_registered,
  FAILED_TO_UPDATE_PASSKEY: m.settings_passkeys_error_rename_failed,
  FAILED_TO_VERIFY_REGISTRATION: m.settings_passkeys_error_verification,
  PASSKEY_NOT_FOUND: m.settings_passkeys_error_not_found,
  PREVIOUSLY_REGISTERED: m.settings_passkeys_error_already_registered,
  SESSION_NOT_FRESH: m.settings_accounts_error_session_not_fresh,
} satisfies Record<string, () => string>;

const API_KEY_MESSAGES = {
  INVALID_NAME_LENGTH: m.settings_api_keys_error_name,
  KEY_NOT_FOUND: m.settings_api_keys_error_not_found,
  NAME_REQUIRED: m.settings_api_keys_error_name,
  SESSION_NOT_FRESH: m.settings_accounts_error_session_not_fresh,
} satisfies Record<string, () => string>;

const isTwoFactorCode = (
  code: string
): code is keyof typeof TWO_FACTOR_MESSAGES =>
  Object.hasOwn(TWO_FACTOR_MESSAGES, code);

const isLinkedAccountCode = (
  code: string
): code is keyof typeof LINKED_ACCOUNT_MESSAGES =>
  Object.hasOwn(LINKED_ACCOUNT_MESSAGES, code);

const isPasskeyCode = (code: string): code is keyof typeof PASSKEY_MESSAGES =>
  Object.hasOwn(PASSKEY_MESSAGES, code);

const isApiKeyCode = (code: string): code is keyof typeof API_KEY_MESSAGES =>
  Object.hasOwn(API_KEY_MESSAGES, code);

const isRateLimited = (error: SecurityRequestError): boolean =>
  error.status === TOO_MANY_REQUESTS;

export const twoFactorErrorMessage = (error: SecurityRequestError): string => {
  if (isRateLimited(error)) {
    return m.auth_error_rate_limited();
  }

  const code = error.code ?? "";

  return isTwoFactorCode(code)
    ? TWO_FACTOR_MESSAGES[code]()
    : m.settings_2fa_error_generic();
};

export const linkedAccountErrorMessage = (
  error: SecurityRequestError
): string => {
  if (isRateLimited(error)) {
    return m.auth_error_rate_limited();
  }

  const code = error.code ?? "";

  return isLinkedAccountCode(code)
    ? LINKED_ACCOUNT_MESSAGES[code]()
    : m.settings_accounts_error_generic();
};

export const passkeyErrorMessage = (error: SecurityRequestError): string => {
  if (isRateLimited(error)) {
    return m.auth_error_rate_limited();
  }

  const code = error.code ?? "";

  return isPasskeyCode(code)
    ? PASSKEY_MESSAGES[code]()
    : m.settings_passkeys_error_generic();
};

export const apiKeyErrorMessage = (error: SecurityRequestError): string => {
  if (isRateLimited(error)) {
    return m.auth_error_rate_limited();
  }

  const code = error.code ?? "";

  return isApiKeyCode(code)
    ? API_KEY_MESSAGES[code]()
    : m.settings_api_keys_error_generic();
};
