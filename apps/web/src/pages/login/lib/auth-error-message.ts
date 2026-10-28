import { m } from "@/paraglide/messages.js";

export interface AuthRequestError {
  code?: string;
  status: number;
}

export interface PasswordBounds {
  maxPasswordLength: number;
  minPasswordLength: number;
}

const TOO_MANY_REQUESTS = 429;

const MESSAGE_BY_CODE = {
  EMAIL_NOT_VERIFIED: m.auth_error_email_not_verified,
  INVALID_BACKUP_CODE: m.auth_error_invalid_backup_code,
  INVALID_CODE: m.auth_error_invalid_otp,
  INVALID_EMAIL_OR_PASSWORD: m.auth_error_invalid_credentials,
  INVALID_OTP: m.auth_error_invalid_otp,
  INVALID_TWO_FACTOR_COOKIE: m.auth_error_two_factor_expired,
  OTP_EXPIRED: m.auth_error_otp_expired,
  PASSWORD_COMPROMISED: m.auth_error_password_compromised,
  SIGN_UP_DISABLED: m.auth_error_sign_up_disabled,
  TOO_MANY_ATTEMPTS: m.auth_error_too_many_attempts,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: m.auth_error_two_factor_expired,
} satisfies Record<string, () => string>;

const isKnownCode = (code: string): code is keyof typeof MESSAGE_BY_CODE =>
  Object.hasOwn(MESSAGE_BY_CODE, code);

export const authErrorMessage = (
  error: AuthRequestError,
  bounds: PasswordBounds | undefined
): string => {
  if (error.status === TOO_MANY_REQUESTS) {
    return m.auth_error_rate_limited();
  }

  const code = error.code ?? "";

  if (code === "PASSWORD_TOO_SHORT") {
    const serverMinimum = bounds?.minPasswordLength;

    return serverMinimum === undefined
      ? m.auth_error_password_too_short_no_bound()
      : m.auth_error_password_too_short({ count: serverMinimum });
  }

  if (code === "PASSWORD_TOO_LONG") {
    const serverMaximum = bounds?.maxPasswordLength;

    return serverMaximum === undefined
      ? m.auth_error_password_too_long_no_bound()
      : m.auth_error_password_too_long({ count: serverMaximum });
  }

  return isKnownCode(code) ? MESSAGE_BY_CODE[code]() : m.auth_error_generic();
};
