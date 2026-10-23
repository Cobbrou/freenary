const TRAILING_SLASHES = /\/+$/u;

export const providerRedirectUrl = (origin: string, provider: string): string =>
  `${origin.replace(TRAILING_SLASHES, "")}/callback/${provider}`;
