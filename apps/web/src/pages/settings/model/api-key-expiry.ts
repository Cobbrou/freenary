const SECONDS_PER_DAY = 86_400;

export const API_KEY_EXPIRY_CHOICES = ["never", "30d", "90d", "1y"] as const;

export type ApiKeyExpiryChoice = (typeof API_KEY_EXPIRY_CHOICES)[number];

export const DEFAULT_API_KEY_EXPIRY: ApiKeyExpiryChoice = "90d";

const EXPIRY_DAYS = {
  "1y": 365,
  "30d": 30,
  "90d": 90,
  never: null,
} satisfies Record<ApiKeyExpiryChoice, number | null>;

export const isApiKeyExpiryChoice = (
  value: string
): value is ApiKeyExpiryChoice => Object.hasOwn(EXPIRY_DAYS, value);

export const expiresInSecondsOf = (
  choice: ApiKeyExpiryChoice
): number | undefined => {
  const days = EXPIRY_DAYS[choice];

  return days === null ? undefined : days * SECONDS_PER_DAY;
};
