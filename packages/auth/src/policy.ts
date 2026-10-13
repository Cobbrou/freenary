const SECONDS_PER_DAY = 24 * 60 * 60;
const SESSION_EXPIRY_DAYS = 7;

export const MIN_PASSWORD_LENGTH = 12;

export const MAX_PASSWORD_LENGTH = 128;

export const OTP_EXPIRY_SECONDS = 600;

export const OTP_LENGTH = 6;

export const SESSION_EXPIRY_SECONDS = SESSION_EXPIRY_DAYS * SECONDS_PER_DAY;

export const OTP_ALLOWED_ATTEMPTS = 3;

export const TRUSTED_DEVICE_DAYS = 30;

export const TRUSTED_DEVICE_SECONDS = TRUSTED_DEVICE_DAYS * SECONDS_PER_DAY;

export const DISABLED_PATHS = {
  "/sign-in/email-otp": true,
} satisfies Record<string, true>;

export const OTP_ISSUING_PATH = "/email-otp/send-verification-otp";

export const DISABLED_OTP_TYPES = {
  "sign-in": true,
} satisfies Record<string, true>;

export const REAUTH_WINDOW_SECONDS = 900;

export const REAUTH_PATHS = {
  "/link-social": true,
  "/passkey/delete-passkey": true,
  "/passkey/generate-register-options": true,
  "/passkey/verify-registration": true,
  "/unlink-account": true,
} satisfies Record<string, true>;

export const RATE_LIMIT_RULES = {
  "/passkey/generate-authenticate-options": { max: 20, window: 60 },
  "/passkey/verify-authentication": { max: 20, window: 60 },
  "/sign-in/email": { max: 10, window: 60 },
  "/sign-in/social": { max: 10, window: 60 },
  "/sign-up/email": { max: 5, window: 300 },
  "/two-factor/verify-backup-code": { max: 5, window: 300 },
  "/two-factor/verify-totp": { max: 10, window: 300 },
} satisfies Record<string, { max: number; window: number }>;

export const RATE_LIMIT_DEFAULT = { max: 100, window: 60 };

export const ACCOUNT_EXISTS_RATE_LIMIT = { max: 20, window: 60 };

export const AI_CHAT_RATE_LIMIT = { max: 30, window: 300 };
