import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import prisma from "@freenary/db";
import { isEmailEnabled } from "@freenary/email";
import { env } from "@freenary/env/server";
import { claimForFirstSession } from "@freenary/instance-config";
import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import {
  emailOTP,
  genericOAuth,
  haveIBeenPwned,
  twoFactor,
} from "better-auth/plugins";
import { Data, Effect } from "effect";

import {
  API_KEY_LENGTH,
  API_KEY_MAX_EXPIRY_DAYS,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_PREFIX,
  API_KEY_RATE_LIMIT,
  API_KEY_SESSION_PATH,
  apiKeyFromHeaders,
  carriesApiKey,
} from "./api-key";
import { sendOtpEmail } from "./emails";
import {
  DISABLED_OTP_TYPES,
  DISABLED_PATHS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  OTP_ALLOWED_ATTEMPTS,
  OTP_EXPIRY_SECONDS,
  OTP_ISSUING_PATH,
  OTP_LENGTH,
  RATE_LIMIT_DEFAULT,
  RATE_LIMIT_RULES,
  REAUTH_PATHS,
  REAUTH_WINDOW_SECONDS,
  SESSION_EXPIRY_SECONDS,
  TRUSTED_DEVICE_SECONDS,
  USER_ADDITIONAL_FIELDS,
} from "./policy";
import {
  appleTrustedOrigins,
  cookiePolicy,
  genericOAuthProviders,
  socialProviders,
} from "./providers";

const APP_NAME = "Freenary";
const MILLISECONDS_PER_SECOND = 1000;

const webAppOrigin = new URL(env.CORS_ORIGIN);
const passkeyRelyingPartyId = webAppOrigin.hostname;

const buildPlugins = (): BetterAuthPlugin[] => {
  const plugins: BetterAuthPlugin[] = [
    twoFactor({
      issuer: APP_NAME,
      trustDeviceMaxAge: TRUSTED_DEVICE_SECONDS,
    }),
    passkey({
      origin: env.CORS_ORIGIN,
      rpID: passkeyRelyingPartyId,
      rpName: APP_NAME,
    }),
    apiKey({
      customAPIKeyGetter: (ctx) => apiKeyFromHeaders(ctx.headers),
      defaultKeyLength: API_KEY_LENGTH,
      defaultPrefix: API_KEY_PREFIX,
      enableSessionForAPIKeys: true,
      keyExpiration: { maxExpiresIn: API_KEY_MAX_EXPIRY_DAYS },
      maximumNameLength: API_KEY_NAME_MAX_LENGTH,
      rateLimit: {
        enabled: true,
        maxRequests: API_KEY_RATE_LIMIT.maxRequests,
        timeWindow: API_KEY_RATE_LIMIT.timeWindowMs,
      },
      requireName: true,
    }),
  ];

  if (isEmailEnabled) {
    plugins.push(
      emailOTP({
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        expiresIn: OTP_EXPIRY_SECONDS,
        otpLength: OTP_LENGTH,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: (request) =>
          sendOtpEmail(request.email, request.otp, request.type),
        storeOTP: "hashed",
      })
    );
  }

  if (genericOAuthProviders.length > 0) {
    plugins.push(genericOAuth({ config: genericOAuthProviders }));
  }

  if (env.AUTH_PASSWORD_BREACH_CHECK) {
    plugins.push(haveIBeenPwned());
  }

  return plugins;
};

const enforceAuthPolicy = createAuthMiddleware(async (ctx) => {
  if (carriesApiKey(ctx.headers) && ctx.path !== API_KEY_SESSION_PATH) {
    throw APIError.from("FORBIDDEN", {
      code: "API_KEY_NOT_ALLOWED",
      message: "An API key cannot call this endpoint",
    });
  }

  if (Object.hasOwn(DISABLED_PATHS, ctx.path)) {
    throw APIError.from("NOT_FOUND", {
      code: "NOT_FOUND",
      message: "Not found",
    });
  }

  if (
    ctx.path === OTP_ISSUING_PATH &&
    Object.hasOwn(DISABLED_OTP_TYPES, String(ctx.body?.type))
  ) {
    throw APIError.from("BAD_REQUEST", {
      code: "INVALID_OTP_TYPE",
      message: "Invalid OTP type",
    });
  }

  if (!Object.hasOwn(REAUTH_PATHS, ctx.path)) {
    return;
  }

  const session = await getSessionFromCtx(ctx);

  if (!session?.session) {
    throw APIError.from("UNAUTHORIZED", {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  }

  const sessionAge = Date.now() - new Date(session.session.createdAt).getTime();

  if (sessionAge >= REAUTH_WINDOW_SECONDS * MILLISECONDS_PER_SECOND) {
    throw APIError.from("FORBIDDEN", {
      code: "SESSION_NOT_FRESH",
      message: "Session is not fresh",
    });
  }
});

export const createAuth = () =>
  betterAuth({
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        enabled: true,
      },
    },

    advanced: {
      crossSubDomainCookies:
        env.AUTH_COOKIE_DOMAIN === undefined
          ? undefined
          : { domain: env.AUTH_COOKIE_DOMAIN, enabled: true },
      defaultCookieAttributes: cookiePolicy,
    },

    appName: APP_NAME,

    baseURL: env.BETTER_AUTH_URL,

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            if (env.SETUP_TOKEN !== undefined) {
              return;
            }

            await Effect.runPromise(
              claimForFirstSession(session.userId).pipe(
                Effect.catchTag("InstanceSetupUnavailable", (claimFailure) =>
                  Effect.logWarning(claimFailure.message)
                )
              )
            );
          },
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      requireEmailVerification: isEmailEnabled,
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      beforeEmailVerification: (userBeforeUpdate) => {
        if (userBeforeUpdate.emailVerified) {
          throw APIError.from("BAD_REQUEST", {
            code: "INVALID_OTP",
            message: "Invalid code",
          });
        }

        return Promise.resolve();
      },
      expiresIn: OTP_EXPIRY_SECONDS,
      sendOnSignIn: true,
    },

    hooks: {
      before: enforceAuthPolicy,
    },

    plugins: buildPlugins(),

    rateLimit: {
      customRules: RATE_LIMIT_RULES,
      enabled: env.NODE_ENV !== "test",
      max: RATE_LIMIT_DEFAULT.max,
      storage: "database",
      window: RATE_LIMIT_DEFAULT.window,
    },

    secret: env.BETTER_AUTH_SECRET,

    session: {
      expiresIn: SESSION_EXPIRY_SECONDS,
      freshAge: SESSION_EXPIRY_SECONDS,
    },

    socialProviders,

    trustedOrigins: [env.CORS_ORIGIN, ...appleTrustedOrigins],

    user: {
      additionalFields: USER_ADDITIONAL_FIELDS,
    },
  });

export const auth = createAuth();

export type ResolvedSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export type ApiKeyRefusal = "invalid" | "rate-limited";

export type RequestCredential =
  | { readonly kind: "resolved"; readonly session: ResolvedSession }
  | { readonly kind: "api-key-refused"; readonly refusal: ApiKeyRefusal };

const TOO_MANY_REQUESTS = 429;

export const apiKeyRefusalOf = (cause: {
  statusCode: number;
}): ApiKeyRefusal =>
  cause.statusCode === TOO_MANY_REQUESTS ? "rate-limited" : "invalid";

class SessionLookupFailed extends Data.TaggedError("SessionLookupFailed")<{
  readonly cause: unknown;
}> {}

const resolveCredential = (headers: Headers) =>
  Effect.tryPromise({
    catch: (cause) => new SessionLookupFailed({ cause }),
    try: () => auth.api.getSession({ headers }),
  }).pipe(
    Effect.map((session): RequestCredential => ({ kind: "resolved", session })),
    Effect.catchTag("SessionLookupFailed", ({ cause }) =>
      carriesApiKey(headers) && isAPIError(cause)
        ? Effect.succeed<RequestCredential>({
            kind: "api-key-refused",
            refusal: apiKeyRefusalOf(cause),
          })
        : Effect.die(cause)
    )
  );

const credentialsByRequestHeaders = new WeakMap<
  Headers,
  Promise<RequestCredential>
>();

export const requestCredential = (
  headers: Headers
): Promise<RequestCredential> => {
  const known = credentialsByRequestHeaders.get(headers);

  if (known) {
    return known;
  }

  const resolving = Effect.runPromise(resolveCredential(headers));

  credentialsByRequestHeaders.set(headers, resolving);

  return resolving;
};

export const requestSession = async (
  headers: Headers
): Promise<ResolvedSession> => {
  const credential = await requestCredential(headers);

  return credential.kind === "resolved" ? credential.session : null;
};

export type { AuthCapabilities, OAuthProviderDescriptor } from "./providers";
export { authCapabilities } from "./providers";
export { resolveCookiePolicy } from "./cookies";
export { carriesApiKey } from "./api-key";
