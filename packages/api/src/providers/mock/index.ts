import { env } from "@freenary/env/server";
import { Data, Effect, Option } from "effect";

import type {
  BankingProvider,
  CompleteConnectionRequest,
  StartConnectionRequest,
} from "../types";
import { MOCK_INSTITUTIONS } from "./catalog";
import { MOCK_CALLBACK_PATH, MOCK_CONSENT_PATH } from "./consent";
import {
  fixtureAccounts,
  fixtureHoldings,
  fixtureInstitutions,
  fixtureTransactions,
  requireFixture,
} from "./fixture/replay";
import type { FixtureConnection } from "./fixture/schema";
import {
  fixtureInstitutionOf,
  openedOnOf,
  SESSION_ACCOUNT_SEPARATOR,
  sessionAccountOf,
} from "./session";

const MOCK_INSTITUTION_COUNTRY = "FR";

export class MockConsentIncomplete extends Data.TaggedError(
  "MockConsentIncomplete"
)<Record<never, never>> {
  override readonly message = "The mock bank callback carries no session code";
}

const isIssuedCode = (code: string): boolean =>
  Option.isSome(openedOnOf(code)) || Option.isSome(fixtureInstitutionOf(code));

const completeConnection = Effect.fn("mock.completeConnection")(
  function* completeConnection(request: CompleteConnectionRequest) {
    const { code } = request.callbackParams;

    if (!(code && isIssuedCode(code))) {
      return yield* new MockConsentIncomplete();
    }

    const providerSessionId = request.providerSessionId ?? code;
    const fixtureInstitution = fixtureInstitutionOf(providerSessionId);

    if (Option.isSome(fixtureInstitution)) {
      const connection = yield* requireFixture(
        fixtureInstitution.value,
        new Date()
      );

      return {
        accounts: fixtureAccounts(
          connection,
          providerSessionId,
          SESSION_ACCOUNT_SEPARATOR
        ).map((account) => ({
          currency: account.currency,
          iban: account.iban,
          name: account.name,
          providerAccountId: account.providerAccountId,
          type: account.type,
        })),
        institutionName: "",
        providerSessionId,
      };
    }

    const { planAccounts } = yield* Effect.promise(() => import("./generate"));

    return {
      accounts: planAccounts(providerSessionId).map((account) => ({
        currency: account.currency,
        iban: account.iban,
        name: account.name,
        providerAccountId: account.providerAccountId,
      })),
      institutionName: "",
      providerSessionId,
    };
  }
);

const withFixture = <A>(
  sessionId: string,
  replay: (connection: FixtureConnection) => A,
  generated: () => Promise<A>
): Promise<A> =>
  Option.match(fixtureInstitutionOf(sessionId), {
    onNone: generated,
    onSome: (institutionId) =>
      Effect.runPromise(
        requireFixture(institutionId, new Date()).pipe(Effect.map(replay))
      ),
  });

const startConnection = (request: StartConnectionRequest) => {
  const consent = new URL(MOCK_CONSENT_PATH, env.BETTER_AUTH_URL);

  consent.searchParams.set("institution", request.institutionId);
  consent.searchParams.set("redirect_uri", request.redirectUrl);
  consent.searchParams.set("state", request.state);

  return Promise.resolve({ url: consent.toString() });
};

export const mockProvider: BankingProvider = {
  callbackPath: MOCK_CALLBACK_PATH,
  closeConnection: () => Promise.resolve(),
  completeConnection: (request) =>
    Effect.runPromise(completeConnection(request)),
  fetchAccounts: (request) =>
    withFixture(
      request.providerSessionId,
      (connection) =>
        fixtureAccounts(
          connection,
          request.providerSessionId,
          SESSION_ACCOUNT_SEPARATOR
        ),
      async () => {
        const { generateAccounts } = await import("./generate");

        return generateAccounts(request.providerSessionId, new Date());
      }
    ),
  fetchHoldings: (request) => {
    const { accountKey, sessionId } = sessionAccountOf(
      request.providerAccountId
    );

    return withFixture(
      sessionId,
      (connection) => fixtureHoldings(connection, accountKey),
      async () => {
        const { generateHoldings } = await import("./generate");

        return generateHoldings(request.providerAccountId, new Date());
      }
    );
  },
  fetchTransactions: (request) => {
    const { accountKey, sessionId } = sessionAccountOf(
      request.providerAccountId
    );

    return withFixture(
      sessionId,
      (connection) =>
        fixtureTransactions(connection, accountKey, request.dateTo),
      async () => {
        const { generateTransactions } = await import("./generate");

        return generateTransactions(
          request.providerAccountId,
          request.dateFrom,
          request.dateTo,
          new Date()
        );
      }
    );
  },
  id: "mock",
  isConfigured: () => true,
  listInstitutions: () =>
    Effect.sync(() => [
      ...MOCK_INSTITUTIONS.map((institution) => ({
        ...institution,
        country: MOCK_INSTITUTION_COUNTRY,
      })),
      ...fixtureInstitutions(),
    ]),
  needsReconnect: () => false,
  startConnection,
};
