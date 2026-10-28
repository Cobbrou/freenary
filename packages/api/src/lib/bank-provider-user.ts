import prisma, { Prisma } from "@freenary/db";
import { Cause, Data, Effect, Result } from "effect";

import type { BankingProvider, ProviderUserSession } from "../providers/types";

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
    select: { accessToken: true, providerUserId: true },
    where: { userId_provider: { provider: provider.id, userId } },
  });

  return row
    ? { accessToken: row.accessToken, providerUserId: row.providerUserId }
    : null;
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
            accessToken: session.accessToken,
            provider: provider.id,
            providerUserId: session.providerUserId,
            userId,
          },
        }),
    }).pipe(
      Effect.as(session),
      Effect.catchTag("ProviderUserAlreadyStored", () =>
        discardProviderUser(provider, session).pipe(
          Effect.andThen(
            Effect.tryPromise({
              catch: (cause) => new Cause.UnknownError(cause),
              try: () => findProviderUser(userId, provider),
            })
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

  if (!session) {
    return;
  }

  await Effect.runPromise(discardProviderUser(provider, session));

  await prisma.bankProviderUser.deleteMany({
    where: { provider: provider.id, userId },
  });
};
