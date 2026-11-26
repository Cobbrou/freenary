import { isEmailEnabled } from "@freenary/email";
import { env } from "@freenary/env/server";
import type { BetterAuthOptions } from "better-auth";
import type { GenericOAuthConfig } from "better-auth/plugins";

import { resolveCookiePolicy } from "./cookies";
import { betterAuthUserOf } from "./person-name";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  TRUSTED_DEVICE_DAYS,
} from "./policy";

export interface OAuthProviderDescriptor {
  id: string;
  name: string | null;
}

export interface AuthCapabilities {
  emailDelivery: boolean;
  maxPasswordLength: number;
  minPasswordLength: number;
  oauth: OAuthProviderDescriptor[];
  otpLength: number;
  passkey: boolean;
  sessionCookieShared: boolean;
  trustedDeviceDays: number;
}

const OIDC_PROVIDER_ID = "oidc";

const OIDC_BASE_SCOPES = ["openid", "email", "profile"];
const APPLE_CALLBACK_ORIGIN = "https://appleid.apple.com";

const google =
  env.GOOGLE_CLIENT_ID === undefined || env.GOOGLE_CLIENT_SECRET === undefined
    ? null
    : {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        mapProfileToUser: betterAuthUserOf,
      };

const apple =
  env.APPLE_CLIENT_ID === undefined || env.APPLE_CLIENT_SECRET === undefined
    ? null
    : {
        appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
        mapProfileToUser: betterAuthUserOf,
      };

const oidcName = env.OIDC_PROVIDER_NAME ?? null;

const oidcScopes = [
  ...new Set([
    ...OIDC_BASE_SCOPES,
    ...(env.OIDC_SCOPES?.split(",").map((scope) => scope.trim()) ?? []),
  ]),
].filter((scope) => scope.length > 0);

export const socialProviders: NonNullable<
  BetterAuthOptions["socialProviders"]
> = {};

if (google !== null) {
  socialProviders.google = google;
}

if (apple !== null) {
  socialProviders.apple = apple;
}

export const genericOAuthProviders: GenericOAuthConfig[] = [];

if (env.OIDC_DISCOVERY_URL !== undefined && env.OIDC_CLIENT_ID !== undefined) {
  genericOAuthProviders.push({
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    discoveryUrl: env.OIDC_DISCOVERY_URL,
    mapProfileToUser: betterAuthUserOf,
    name: oidcName ?? OIDC_PROVIDER_ID,
    providerId: OIDC_PROVIDER_ID,
    requireIdTokenVerification: true,
    scopes: oidcScopes,
  });
}

export const appleTrustedOrigins =
  apple === null ? [] : [APPLE_CALLBACK_ORIGIN];

export const cookiePolicy = resolveCookiePolicy({
  authUrl: env.BETTER_AUTH_URL,
  cookieDomain: env.AUTH_COOKIE_DOMAIN,
  isProduction: env.NODE_ENV === "production",
  webOrigin: env.CORS_ORIGIN,
});

const oauth: OAuthProviderDescriptor[] = [];

if (google !== null) {
  oauth.push({ id: "google", name: null });
}

if (apple !== null) {
  oauth.push({ id: "apple", name: null });
}

if (genericOAuthProviders.length > 0) {
  oauth.push({ id: OIDC_PROVIDER_ID, name: oidcName });
}

export const authCapabilities: AuthCapabilities = {
  emailDelivery: isEmailEnabled,
  maxPasswordLength: MAX_PASSWORD_LENGTH,
  minPasswordLength: MIN_PASSWORD_LENGTH,
  oauth,
  otpLength: OTP_LENGTH,
  passkey: true,
  sessionCookieShared: cookiePolicy.sameSite === "lax",
  trustedDeviceDays: TRUSTED_DEVICE_DAYS,
};
