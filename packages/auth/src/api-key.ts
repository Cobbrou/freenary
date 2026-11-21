export const API_KEY_PREFIX = "fny_";

export const API_KEY_LENGTH = 64;

export const API_KEY_HEADER = "x-api-key";

export const API_KEY_NAME_MAX_LENGTH = 32;

export const API_KEY_MAX_EXPIRY_DAYS = 365;

export const API_KEY_RATE_LIMIT = { maxRequests: 120, timeWindowMs: 60_000 };

export const API_KEY_SESSION_PATH = "/get-session";

const BEARER_CREDENTIAL = /^Bearer\s+(?<credential>\S+)\s*$/iu;

export const apiKeyFromHeaders = (
  headers: Headers | null | undefined
): string | null => {
  const header = headers?.get(API_KEY_HEADER)?.trim();

  if (header) {
    return header;
  }

  const bearer = headers?.get("authorization")?.match(BEARER_CREDENTIAL);

  return bearer?.groups?.credential ?? null;
};

export const carriesApiKey = (headers: Headers | null | undefined): boolean =>
  apiKeyFromHeaders(headers) !== null;
