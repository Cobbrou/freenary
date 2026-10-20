import { env } from "@freenary/env/server";
import { Data, Effect, Option } from "effect";

import type {
  BankingProvider,
  CompleteConnectionRequest,
  StartConnectionRequest,
} from "../types";
import { MOCK_INSTITUTIONS } from "./catalog";
import { MOCK_CALLBACK_PATH, MOCK_CONSENT_PATH } from "./consent";
import { openedOnOf } from "./session";

export class MockConsentIncomplete extends Data.TaggedError(
  "MockConsentIncomplete"
)<Record<never, never>> {
  override readonly message = "The mock bank callback carries no session code";
}

const completeConnection = Effect.fn("mock.completeConnection")(
  function* completeConnection(request: CompleteConnectionRequest) {
    const { code } = request.callbackParams;

    if (!(code && Option.isSome(openedOnOf(code)))) {
      return yield* new MockConsentIncomplete();
    }

    const { planAccounts } = yield* Effect.promise(() => import("./generate"));

    return {
      accounts: planAccounts(code).map((account) => ({
        iban: account.iban,
        name: account.name,
        providerAccountId: account.providerAccountId,
      })),
      institutionName: "",
      providerSessionId: code,
    };
  }
);

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
  fetchAccounts: async (request) => {
    const { generateAccounts } = await import("./generate");

    return generateAccounts(request.providerSessionId, new Date());
  },
  fetchHoldings: async (request) => {
    const { generateHoldings } = await import("./generate");

    return generateHoldings(request.providerAccountId, new Date());
  },
  fetchTransactions: async (request) => {
    const { generateTransactions } = await import("./generate");

    return generateTransactions(
      request.providerAccountId,
      request.dateFrom,
      request.dateTo,
      new Date()
    );
  },
  id: "mock",
  isConfigured: () => true,
  listInstitutions: (country) =>
    Effect.succeed(
      MOCK_INSTITUTIONS.map((institution) => ({ ...institution, country }))
    ),
  startConnection,
};
