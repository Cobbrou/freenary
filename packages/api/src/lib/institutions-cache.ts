import { ORPCError } from "@orpc/server";
import { Effect } from "effect";

import type { BankingProvider, ProviderInstitution } from "../providers/types";

export const INSTITUTIONS_CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedInstitutions {
  expiresAt: number;
  institutions: ProviderInstitution[];
}

interface InstitutionsLoaderOptions {
  now?: () => number;
  ttlMs?: number;
}

type InstitutionsSource = Pick<BankingProvider, "id" | "listInstitutions">;

export type InstitutionsLoader = (
  provider: InstitutionsSource
) => Promise<ProviderInstitution[]>;

export const institutionsLoaderWith = ({
  now = Date.now,
  ttlMs = INSTITUTIONS_CACHE_TTL_MS,
}: InstitutionsLoaderOptions = {}): InstitutionsLoader => {
  const cache = new Map<string, CachedInstitutions>();

  return async (provider) => {
    const cached = cache.get(provider.id);

    if (cached && cached.expiresAt > now()) {
      return cached.institutions;
    }

    const institutions = await Effect.runPromise(
      provider
        .listInstitutions()
        .pipe(
          Effect.catchTag("BankInstitutionsUnavailable", (cause) =>
            Effect.logWarning("Bank institutions unavailable", cause).pipe(
              Effect.as(null)
            )
          )
        )
    );

    if (institutions === null) {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Could not load banks",
      });
    }

    cache.set(provider.id, { expiresAt: now() + ttlMs, institutions });

    return institutions;
  };
};
