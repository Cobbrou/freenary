import prisma from "@freenary/db";
import { env } from "@freenary/env/server";
import { ORPCError } from "@orpc/server";
import { Effect, Option } from "effect";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  findProviderUser,
  ensureProviderUser,
  releaseProviderUser,
} from "../lib/bank-provider-user";
import {
  isoAlpha2CountryCode,
  taxResidencyCountries,
} from "../lib/country-code";
import { getDefaultProvider, getProvider } from "../providers/registry";
import type { BankingProvider, ProviderInstitution } from "../providers/types";
import type { BankConnectionState } from "./bank-connection-state";
import {
  BANK_CONNECTION_RETURN_TARGETS,
  encodeBankConnectionState,
  findInstitution,
  parseBankConnectionState,
  verifyBankConnectionState,
} from "./bank-connection-state";

const providerById = Option.liftThrowable(getProvider);

const decodeConnectionState = Option.liftThrowable(parseBankConnectionState);

const LIST_INSTITUTIONS_CONCURRENCY = 3;

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

const requireInstitutionsOf = async (
  provider: BankingProvider,
  country: string
): Promise<ProviderInstitution[]> => {
  const institutions = await Effect.runPromise(
    provider
      .listInstitutions(country)
      .pipe(
        Effect.catchTag("BankInstitutionsUnavailable", (cause) =>
          Effect.logWarning(
            "Bank institutions unavailable",
            country,
            cause
          ).pipe(Effect.as(null))
        )
      )
  );

  if (institutions === null) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Could not load banks for this country",
    });
  }

  return institutions;
};

export const bankConnectionRouter = {
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

      await prisma.bankConnection.delete({ where: { id: connection.id } });

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
        params: z.record(z.string(), z.string()),
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

      const institutions = await requireInstitutionsOf(
        provider,
        connectionState.institution.country
      );

      const institution = findInstitution(
        institutions,
        connectionState.institution.id,
        connectionState.institution.country
      );

      if (!institution) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Bank institution is no longer available",
        });
      }

      const providerUser = await findProviderUser(userId, provider);

      if (!providerUser && provider.createUser) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No provider session for this user",
        });
      }

      const completed = await provider.completeConnection({
        callbackParams: input.params,
        user: providerUser,
      });

      const providerInstitutionName = completed.institutionName.trim();
      const bankName = providerInstitutionName || institution.name;

      const connection = await prisma.$transaction(async (db) => {
        const created = await db.bankConnection.create({
          data: {
            institutionBic: institution.bic ?? null,
            institutionCountry: institution.country,
            institutionGroup:
              completed.institutionGroup ?? institution.group ?? null,
            institutionId: institution.id,
            institutionName: bankName,
            provider: provider.id,
            providerSessionId: completed.providerSessionId,
            userId,
          },
        });

        await db.bankAccount.createMany({
          data: completed.accounts.map((account) => ({
            connectionId: created.id,
            iban: account.iban ?? null,
            identificationHash: account.identificationHash ?? null,
            name: account.name ?? null,
            providerAccountId: account.providerAccountId,
          })),
        });

        return created;
      });

      return {
        accounts: completed.accounts.map((a) => ({
          iban: a.iban,
          name: a.name,
          uid: a.providerAccountId,
        })),
        connectionId: connection.id,
        institutionName: bankName,
        returnTo: connectionState.returnTo,
        sessionId: completed.providerSessionId,
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
          orderBy: { createdAt: "asc" },
          select: { iban: true, id: true, name: true },
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

    return { connections };
  }),

  listInstitutions: protectedProcedure
    .input(z.object({ countries: taxResidencyCountries.optional() }))
    .handler(async ({ context, input }) => {
      let { countries } = input;

      if (!countries?.length) {
        const user = await prisma.user.findUniqueOrThrow({
          select: { taxCountries: true },
          where: { id: context.session.user.id },
        });

        countries = user.taxCountries;
      }

      if (countries.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No country to list banks for",
        });
      }

      const provider = getDefaultProvider();
      const perCountry = await Effect.runPromise(
        Effect.forEach(
          [...new Set(countries)],
          (country) =>
            provider.listInstitutions(country).pipe(
              Effect.catchTag("BankInstitutionsUnavailable", (cause) =>
                Effect.logWarning(
                  "Bank institutions unavailable",
                  country,
                  cause
                ).pipe(Effect.as(null))
              ),
              Effect.map((institutions) => ({ country, institutions }))
            ),
          { concurrency: LIST_INSTITUTIONS_CONCURRENCY }
        )
      );

      const seen = new Set<string>();
      const banks: {
        bic: string | null;
        country: string;
        id: string;
        logo: string | null;
        name: string;
      }[] = [];

      const unavailableCountries: string[] = [];

      for (const listed of perCountry) {
        if (listed.institutions === null) {
          unavailableCountries.push(listed.country);

          continue;
        }

        for (const inst of listed.institutions) {
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
      }

      return { banks, unavailableCountries };
    }),

  startConnection: protectedProcedure
    .input(
      z.object({
        bankCountry: isoAlpha2CountryCode,
        institutionId: z.string(),
        returnTo: z.enum(BANK_CONNECTION_RETURN_TARGETS),
        state: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const provider = getDefaultProvider();
      const institutions = await requireInstitutionsOf(
        provider,
        input.bankCountry
      );

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

      const providerUser = await ensureProviderUser(userId, provider);
      const redirectUrl = `${env.CORS_ORIGIN}${provider.callbackPath}`;
      const encodedState = encodeBankConnectionState({
        institution,
        original: input.state,
        providerId: provider.id,
        returnTo: input.returnTo,
        secret: env.BETTER_AUTH_SECRET,
        userId,
      });

      return await provider.startConnection({
        country: input.bankCountry,
        institutionId: institution.id,
        redirectUrl,
        state: encodedState,
        user: providerUser,
      });
    }),
};
