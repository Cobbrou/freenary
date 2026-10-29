import prisma, { Prisma } from "@freenary/db";
import { env } from "@freenary/env/server";
import { seal, unseal } from "@freenary/instance-config/seal";
import type { SealedValueUnreadable } from "@freenary/instance-config/seal";
import { Cause, Data, Effect, Result } from "effect";

import type { BankingProvider, ProviderUserSession } from "../providers/types";

const SEALED_PREFIX = "sealed:";

interface OpenedToken {
  readonly isLegacyPlaintext: boolean;
  readonly token: string;
}

interface StoredRow {
  readonly accessToken: string;
  readonly provider: string;
  readonly userId: string;
}

export const tokenSealKey = (provider: string, userId: string): string =>
  `bank_provider_user:${provider}:${userId}`;

export const sealToken = (secret: string, key: string, token: string): string =>
  `${SEALED_PREFIX}${seal(secret, key, token)}`;

export const openStoredToken = (
  secret: string,
  key: string,
  stored: string
): Result.Result<OpenedToken, SealedValueUnreadable> =>
  stored.startsWith(SEALED_PREFIX)
    ? Result.map(
        unseal(secret, key, stored.slice(SEALED_PREFIX.length)),
        (token) => ({ isLegacyPlaintext: false, token })
      )
    : Result.succeed({ isLegacyPlaintext: true, token: stored });

const sealRowToken = (row: StoredRow, token: string): string =>
  sealToken(
    env.BETTER_AUTH_SECRET,
    tokenSealKey(row.provider, row.userId),
    token
  );

const replaceStoredToken = (
  row: StoredRow,
  replacement: { accessToken: string; providerUserId?: string }
) =>
  prisma.bankProviderUser.updateMany({
    data: replacement,
    where: {
      accessToken: row.accessToken,
      provider: row.provider,
      userId: row.userId,
    },
  });

const openRow = async (row: StoredRow): Promise<string | null> => {
  const opened = openStoredToken(
    env.BETTER_AUTH_SECRET,
    tokenSealKey(row.provider, row.userId),
    row.accessToken
  );

  if (Result.isFailure(opened)) {
    console.warn(
      `[bank] The ${row.provider} token of user ${row.userId} does not open with the current BETTER_AUTH_SECRET. Connecting a bank again replaces it; the banks linked before keep failing until they are disconnected.`
    );

    return null;
  }

  if (opened.success.isLegacyPlaintext) {
    await replaceStoredToken(row, {
      accessToken: sealRowToken(row, opened.success.token),
    });
  }

  return opened.success.token;
};

export const sealLegacyProviderTokens = async (): Promise<void> => {
  const rows = await prisma.bankProviderUser.findMany({
    select: { accessToken: true, provider: true, userId: true },
    where: { NOT: { accessToken: { startsWith: SEALED_PREFIX } } },
  });

  await prisma.$transaction(
    rows.map((row) =>
      replaceStoredToken(row, {
        accessToken: sealRowToken(row, row.accessToken),
      })
    )
  );
};

const claimUnreadableRow = async (
  userId: string,
  provider: BankingProvider,
  session: ProviderUserSession
): Promise<ProviderUserSession | null> => {
  const row = await prisma.bankProviderUser.findUnique({
    select: { accessToken: true, provider: true, userId: true },
    where: { userId_provider: { provider: provider.id, userId } },
  });

  const isReadableOrGone =
    row === null ||
    Result.isSuccess(
      openStoredToken(
        env.BETTER_AUTH_SECRET,
        tokenSealKey(provider.id, userId),
        row.accessToken
      )
    );

  if (isReadableOrGone) {
    return null;
  }

  const { count } = await replaceStoredToken(row, {
    accessToken: sealRowToken(row, session.accessToken),
    providerUserId: session.providerUserId,
  });

  return count === 1 ? session : null;
};

class ProviderUserAlreadyStored extends Data.TaggedError(
  "ProviderUserAlreadyStored"
)<{
  readonly provider: string;
  readonly userId: string;
}> {}

const isUniqueViolation = (cause: unknown): boolean =>
  cause instanceof Prisma.PrismaClientKnownRequestError &&
  cause.code === "P2002";

const discardProviderUser = (
  provider: BankingProvider,
  session: ProviderUserSession
): Effect.Effect<void> =>
  Effect.ignore(
    Effect.tryPromise(() => provider.deleteUser?.(session) ?? Promise.resolve())
  );

export const findProviderUser = async (
  userId: string,
  provider: BankingProvider
): Promise<ProviderUserSession | null> => {
  if (!provider.createUser) {
    return null;
  }

  const row = await prisma.bankProviderUser.findUnique({
    select: {
      accessToken: true,
      provider: true,
      providerUserId: true,
      userId: true,
    },
    where: { userId_provider: { provider: provider.id, userId } },
  });

  if (!row) {
    return null;
  }

  const accessToken = await openRow(row);

  return accessToken === null
    ? null
    : { accessToken, providerUserId: row.providerUserId };
};

export const ensureProviderUser = async (
  userId: string,
  provider: BankingProvider
): Promise<ProviderUserSession | null> => {
  const existing = await findProviderUser(userId, provider);

  if (existing || !provider.createUser) {
    return existing;
  }

  const session = await provider.createUser();

  const stored = await Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) =>
        isUniqueViolation(cause)
          ? new ProviderUserAlreadyStored({ provider: provider.id, userId })
          : new Cause.UnknownError(cause),
      try: () =>
        prisma.bankProviderUser.create({
          data: {
            accessToken: sealToken(
              env.BETTER_AUTH_SECRET,
              tokenSealKey(provider.id, userId),
              session.accessToken
            ),
            provider: provider.id,
            providerUserId: session.providerUserId,
            userId,
          },
        }),
    }).pipe(
      Effect.as(session),
      Effect.catchTag("ProviderUserAlreadyStored", () =>
        Effect.tryPromise({
          catch: (cause) => new Cause.UnknownError(cause),
          try: () => claimUnreadableRow(userId, provider, session),
        }).pipe(
          Effect.flatMap((claimed) =>
            claimed
              ? Effect.succeed(claimed)
              : discardProviderUser(provider, session).pipe(
                  Effect.andThen(
                    Effect.tryPromise({
                      catch: (cause) => new Cause.UnknownError(cause),
                      try: () => findProviderUser(userId, provider),
                    })
                  )
                )
          )
        )
      ),
      Effect.result
    )
  );

  return Result.getOrThrowWith(stored, (failure) => failure.cause);
};

export const releaseProviderUser = async (
  userId: string,
  provider: BankingProvider
): Promise<void> => {
  const { deleteUser } = provider;

  if (!deleteUser) {
    return;
  }

  const remaining = await prisma.bankConnection.count({
    where: { provider: provider.id, userId },
  });

  if (remaining > 0) {
    return;
  }

  const session = await findProviderUser(userId, provider);

  if (session) {
    await Effect.runPromise(discardProviderUser(provider, session));
  }

  await prisma.bankProviderUser.deleteMany({
    where: { provider: provider.id, userId },
  });
};
