import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import type { Prisma, TransactionClient } from "@freenary/db";
import { env } from "@freenary/env/server";
import { ORPCError } from "@orpc/server";
import { Data, Effect, Option } from "effect";
import { z } from "zod";

import { LOCALE } from "../assistant/turn";
import { protectedProcedure } from "../index";
import type {
  BankConnectionReturnTarget,
  BankConnectionState,
} from "../lib/bank-connection-state";
import {
  BANK_CONNECTION_RETURN_TARGETS,
  encodeBankConnectionState,
  findInstitution,
  parseBankConnectionState,
  verifyBankConnectionState,
} from "../lib/bank-connection-state";
import {
  findProviderUser,
  ensureProviderUser,
  releaseProviderUser,
} from "../lib/bank-provider-user";
import { startAccountSync } from "../lib/bank-sync";
import { isoAlpha2CountryCode } from "../lib/country-code";
import { exchangeOnceWith } from "../lib/exchange-once";
import { institutionsLoaderWith } from "../lib/institutions-cache";
import {
  rematchReleasedTransfers,
  releasePairedTransfers,
} from "../lib/remove-bank-accounts";
import { reopenConnection } from "../lib/reopen-connection";
import { getDefaultProvider, getProvider } from "../providers/registry";
import type {
  BankingProvider,
  CompletedConnection,
  ProviderInstitution,
} from "../providers/types";

class FirstSyncNotStarted extends Data.TaggedError("FirstSyncNotStarted")<{
  readonly cause: unknown;
}> {}

const providerById = Option.liftThrowable(getProvider);

const decodeConnectionState = Option.liftThrowable(parseBankConnectionState);

const BANK_CONNECTION_STATE_IDENTIFIER = "bank-connection-state";
const BANK_CONNECTION_STATE_TTL_MS = 60 * 60 * 1000;

const MAX_CALLBACK_PARAMS = 20;
const MAX_CALLBACK_PARAM_KEY_LENGTH = 100;
const MAX_CALLBACK_PARAM_VALUE_LENGTH = 4096;

const resolveProvider = (providerId: string): BankingProvider =>
  Option.getOrThrowWith(
    providerById(providerId),
    () => new ORPCError("NOT_FOUND", { message: "Unknown banking provider" })
  );

const readConnectionState = (
  state: string,
  providerId: string,
  userId: string
): BankConnectionState => {
  const connectionState = Option.getOrThrowWith(
    decodeConnectionState(state),
    () =>
      new ORPCError("BAD_REQUEST", {
        message: "Invalid bank connection state",
      })
  );

  if (connectionState.providerId !== providerId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid banking provider in connection state",
    });
  }

  if (
    !verifyBankConnectionState(connectionState, userId, env.BETTER_AUTH_SECRET)
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Bank connection state does not belong to this session",
    });
  }

  return connectionState;
};

const issueStateNonce = async (userId: string): Promise<string> => {
  const now = new Date();
  const nonce = randomUUID();

  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: {
        expiresAt: { lte: now },
        identifier: BANK_CONNECTION_STATE_IDENTIFIER,
      },
    }),
    prisma.verification.create({
      data: {
        expiresAt: new Date(now.getTime() + BANK_CONNECTION_STATE_TTL_MS),
        id: nonce,
        identifier: BANK_CONNECTION_STATE_IDENTIFIER,
        value: userId,
      },
    }),
  ]);

  return nonce;
};

const claimStateNonce = async (
  nonce: string,
  userId: string
): Promise<boolean> => {
  const { count } = await prisma.verification.deleteMany({
    where: {
      expiresAt: { gt: new Date() },
      id: nonce,
      identifier: BANK_CONNECTION_STATE_IDENTIFIER,
      value: userId,
    },
  });

  return count > 0;
};

const EXCHANGED_CONNECTION = {
  accounts: {
    orderBy: { createdAt: "asc" },
    select: { iban: true, name: true, providerAccountId: true },
    where: { inConsent: true },
  },
  id: true,
  institutionName: true,
  providerSessionId: true,
} satisfies Prisma.BankConnectionSelect;

type ExchangedConnection = Prisma.BankConnectionGetPayload<{
  select: typeof EXCHANGED_CONNECTION;
}>;

interface Exchanged {
  readonly connection: ExchangedConnection;
  readonly leftOutAccountIds: readonly string[];
  readonly syncStartedAt: Date | null;
}

const exchangeOnce = exchangeOnceWith<Exchanged>();

const findExchanged = async (
  exchangeNonce: string,
  userId: string
): Promise<Exchanged | null> => {
  const connection = await prisma.bankConnection.findFirst({
    select: EXCHANGED_CONNECTION,
    where: { exchangeNonce, userId },
  });

  return (
    connection && { connection, leftOutAccountIds: [], syncStartedAt: null }
  );
};

const startFirstSync = (
  userId: string,
  connectionId: string
): Promise<Date | null> =>
  Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new FirstSyncNotStarted({ cause }),
      try: () => startAccountSync(userId, { connectionId, force: false }),
    }).pipe(
      Effect.catchTag("FirstSyncNotStarted", (failure) =>
        Effect.logWarning("First bank sync not started", failure).pipe(
          Effect.as(null)
        )
      )
    )
  );

const loadInstitutions = institutionsLoaderWith();

interface ConsentRequest {
  readonly connection?: { readonly id: string; readonly sessionId: string };
  readonly institution: ProviderInstitution;
  readonly locale?: string;
  readonly original?: string;
  readonly provider: BankingProvider;
  readonly returnTo: BankConnectionReturnTarget;
  readonly userId: string;
}

const startConsent = async ({
  connection,
  institution,
  locale,
  original,
  provider,
  returnTo,
  userId,
}: ConsentRequest): Promise<{ url: string }> => {
  const providerUser = await ensureProviderUser(userId, provider);
  const nonce = await issueStateNonce(userId);

  return await provider.startConnection({
    country: institution.country,
    institutionId: institution.id,
    locale,
    providerSessionId: connection?.sessionId,
    redirectUrl: `${env.CORS_ORIGIN}${provider.callbackPath}`,
    state: encodeBankConnectionState({
      connectionId: connection?.id,
      institution,
      nonce,
      original,
      providerId: provider.id,
      returnTo,
      secret: env.BETTER_AUTH_SECRET,
      userId,
    }),
    user: providerUser,
  });
};

interface StoredConsent {
  readonly connection: ExchangedConnection;
  readonly leftOutAccountIds: readonly string[];
}

interface ConsentOutcome {
  readonly providerSessionId?: string;
  readonly store: (
    completed: CompletedConnection,
    exchangeNonce: string
  ) => Promise<StoredConsent>;
}

const requireConnection = async (connectionId: string, userId: string) => {
  const connection = await prisma.bankConnection.findFirst({
    where: { id: connectionId, userId },
  });

  if (!connection) {
    throw new ORPCError("NOT_FOUND", { message: "Bank connection not found" });
  }

  return connection;
};

const reopening = async (
  connectionId: string,
  userId: string
): Promise<ConsentOutcome> => {
  const { providerSessionId } = await requireConnection(connectionId, userId);

  return {
    providerSessionId,
    store: async (completed, exchangeNonce) => {
      const { leftOutAccountIds } = await reopenConnection(
        connectionId,
        completed,
        exchangeNonce
      );

      return {
        connection: await prisma.bankConnection.findUniqueOrThrow({
          select: EXCHANGED_CONNECTION,
          where: { id: connectionId },
        }),
        leftOutAccountIds,
      };
    },
  };
};

const opening = async (
  { institution: chosen }: BankConnectionState,
  provider: BankingProvider,
  userId: string
): Promise<ConsentOutcome> => {
  const institution = findInstitution(
    await loadInstitutions(provider),
    chosen.id,
    chosen.country
  );

  if (!institution) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Bank institution is no longer available",
    });
  }

  return {
    store: async (completed, exchangeNonce) => ({
      connection: await prisma.bankConnection.upsert({
        create: {
          accounts: {
            create: completed.accounts.map((account) => ({
              currency: account.currency ?? null,
              iban: account.iban ?? null,
              identificationHash: account.identificationHash ?? null,
              name: account.name ?? null,
              providerAccountId: account.providerAccountId,
              type: account.type,
            })),
          },
          exchangeNonce,
          institutionBic: institution.bic ?? null,
          institutionCountry: institution.country,
          institutionGroup:
            completed.institutionGroup ?? institution.group ?? null,
          institutionId: institution.id,
          institutionName: completed.institutionName.trim() || institution.name,
          provider: provider.id,
          providerSessionId: completed.providerSessionId,
          userId,
        },
        select: EXCHANGED_CONNECTION,
        update: { exchangeNonce },
        where: {
          userId_provider_providerSessionId: {
            provider: provider.id,
            providerSessionId: completed.providerSessionId,
            userId,
          },
        },
      }),
      leftOutAccountIds: [],
    }),
  };
};

const deleteAccountsRefusal = async (
  db: TransactionClient,
  userId: string,
  accountIds: readonly string[],
  deleted: number
): Promise<ORPCError<string, unknown>> => {
  const kept = await db.bankAccount.count({
    where: { connection: { userId }, id: { in: [...accountIds] } },
  });

  return kept + deleted === accountIds.length
    ? new ORPCError("PRECONDITION_FAILED", {
        message: "Bank account is still shared by its bank",
      })
    : new ORPCError("NOT_FOUND", { message: "Bank account not found" });
};

const SHARED_ACCOUNT_FIRST = [
  { inConsent: "desc" },
  { createdAt: "asc" },
] satisfies Prisma.BankAccountOrderByWithRelationInput[];

export const bankConnectionRouter = {
  deleteAccounts: protectedProcedure
    .input(
      z.object({
        accountIds: z.array(z.string().max(64)).min(1).max(100),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const accountIds = [...new Set(input.accountIds)];

      const released = await prisma.$transaction(async (db) => {
        const removed = {
          connection: { userId },
          id: { in: accountIds },
          inConsent: false,
        } satisfies Prisma.BankAccountWhereInput;

        const releasedLegs = await releasePairedTransfers(db, userId, removed);
        const { count } = await db.bankAccount.deleteMany({ where: removed });

        if (count !== accountIds.length) {
          throw await deleteAccountsRefusal(db, userId, accountIds, count);
        }

        return releasedLegs;
      });

      await rematchReleasedTransfers(userId, released);

      return { accountsRemoved: accountIds.length };
    }),

  disconnect: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const connection = await prisma.bankConnection.findFirst({
        select: {
          _count: { select: { accounts: true } },
          id: true,
          institutionName: true,
          provider: true,
          providerSessionId: true,
        },
        where: { id: input.connectionId, userId },
      });

      if (!connection) {
        throw new ORPCError("NOT_FOUND", {
          message: "Bank connection not found",
        });
      }

      const provider = getProvider(connection.provider);
      const providerUser = await findProviderUser(userId, provider);
      const revocationRequested = provider.isConfigured()
        ? await provider
            .closeConnection({
              providerSessionId: connection.providerSessionId,
              user: providerUser,
            })
            .then(() => true)
            .catch(() => false)
        : false;

      const released = await prisma.$transaction(async (db) => {
        const releasedLegs = await releasePairedTransfers(db, userId, {
          connectionId: connection.id,
        });

        await db.bankConnection.delete({ where: { id: connection.id } });

        return releasedLegs;
      });

      await rematchReleasedTransfers(userId, released);

      await releaseProviderUser(userId, provider);

      return {
        accountsRemoved: connection._count.accounts,
        institutionName: connection.institutionName,
        revocationRequested,
      };
    }),

  exchangeCode: protectedProcedure
    .input(
      z.object({
        params: z
          .record(
            z.string().max(MAX_CALLBACK_PARAM_KEY_LENGTH),
            z.string().max(MAX_CALLBACK_PARAM_VALUE_LENGTH)
          )
          .refine(
            (params) => Object.keys(params).length <= MAX_CALLBACK_PARAMS,
            { message: `At most ${MAX_CALLBACK_PARAMS} callback parameters` }
          ),
        providerId: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const provider = resolveProvider(input.providerId);
      const userId = context.session.user.id;
      const { state } = input.params;

      if (!state) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Missing bank connection state",
        });
      }

      const connectionState = readConnectionState(state, provider.id, userId);

      const outcome = connectionState.connectionId
        ? await reopening(connectionState.connectionId, userId)
        : await opening(connectionState, provider, userId);

      const providerUser = await findProviderUser(userId, provider);

      if (!providerUser && provider.createUser) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No provider session for this user",
        });
      }

      const { nonce } = connectionState;

      const { connection, leftOutAccountIds, syncStartedAt } =
        await exchangeOnce({
          claim: () => claimStateNonce(nonce, userId),
          exchange: async () => {
            const completed = await provider.completeConnection({
              callbackParams: input.params,
              providerSessionId: outcome.providerSessionId,
              user: providerUser,
            });

            const stored = await outcome.store(completed, nonce);

            return {
              ...stored,
              syncStartedAt: await startFirstSync(userId, stored.connection.id),
            };
          },
          findExchanged: () => findExchanged(nonce, userId),
          nonce,
        });

      return {
        accounts: connection.accounts.map((account) => ({
          iban: account.iban ?? undefined,
          name: account.name ?? undefined,
          uid: account.providerAccountId,
        })),
        connectionId: connection.id,
        institutionName: connection.institutionName,
        leftOutAccountIds: [...leftOutAccountIds],
        returnTo: connectionState.returnTo,
        sessionId: connection.providerSessionId,
        syncStartedAt,
      };
    }),

  getProviderAvailability: protectedProcedure.handler(() => ({
    available: getDefaultProvider().isConfigured(),
  })),

  listConnections: protectedProcedure.handler(async ({ context }) => {
    const connections = await prisma.bankConnection.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        accounts: {
          orderBy: SHARED_ACCOUNT_FIRST,
          select: {
            _count: { select: { transactions: true } },
            iban: true,
            id: true,
            inConsent: true,
            name: true,
            type: true,
          },
        },
        id: true,
        institutionCountry: true,
        institutionId: true,
        institutionName: true,
        lastSyncedAt: true,
        status: true,
      },
      where: { userId: context.session.user.id },
    });

    return {
      connections: connections.map(({ accounts, ...connection }) => ({
        ...connection,
        accounts: accounts.map(({ _count, ...account }) => ({
          ...account,
          transactionCount: _count.transactions,
        })),
      })),
    };
  }),

  listInstitutions: protectedProcedure.handler(async () => {
    const institutions = await loadInstitutions(getDefaultProvider());
    const seen = new Set<string>();
    const banks: {
      bic: string | null;
      country: string;
      id: string;
      logo: string | null;
      name: string;
    }[] = [];

    for (const inst of institutions) {
      const key = `${inst.country}:${inst.id}`;

      if (!seen.has(key)) {
        seen.add(key);
        banks.push({
          bic: inst.bic ?? null,
          country: inst.country,
          id: inst.id,
          logo: inst.logoUrl ?? null,
          name: inst.name,
        });
      }
    }

    return { banks };
  }),

  reconnect: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        locale: z.string().regex(LOCALE).optional(),
        returnTo: z.enum(BANK_CONNECTION_RETURN_TARGETS),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const connection = await requireConnection(input.connectionId, userId);

      if (!(connection.institutionId && connection.institutionCountry)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Bank connection has no institution to reconnect to",
        });
      }

      return await startConsent({
        connection: {
          id: connection.id,
          sessionId: connection.providerSessionId,
        },
        institution: {
          country: connection.institutionCountry,
          id: connection.institutionId,
          name: connection.institutionName,
        },
        locale: input.locale,
        provider: resolveProvider(connection.provider),
        returnTo: input.returnTo,
        userId,
      });
    }),

  startConnection: protectedProcedure
    .input(
      z.object({
        bankCountry: isoAlpha2CountryCode,
        institutionId: z.string(),
        locale: z.string().regex(LOCALE).optional(),
        returnTo: z.enum(BANK_CONNECTION_RETURN_TARGETS),
        state: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const provider = getDefaultProvider();
      const institutions = await loadInstitutions(provider);

      const institution = findInstitution(
        institutions,
        input.institutionId,
        input.bankCountry
      );

      if (!institution) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Unknown bank institution",
        });
      }

      return await startConsent({
        institution,
        locale: input.locale,
        original: input.state,
        provider,
        returnTo: input.returnTo,
        userId,
      });
    }),
};
