import { Data, Effect } from "effect";

import { BankInstitutionsUnavailable } from "../types";
import type {
  BankingProvider,
  CompleteConnectionRequest,
  ConnectionRequest,
  FetchTransactionsRequest,
  StartConnectionRequest,
} from "../types";
import {
  EBAuthorizationSchema,
  EBCompletedConnectionSchema,
  EBInstitutionsSchema,
  ebDeleteIfPresent,
  ebJson,
  fetchTransactionPages,
  isConfigured,
} from "./client";
import { mapEBCompletedConnection } from "./map-connection";
import { mapEBTransactions } from "./map-transaction";

export class EnableBankingCallbackIncomplete extends Data.TaggedError(
  "EnableBankingCallbackIncomplete"
)<Record<never, never>> {
  override readonly message =
    "Enable Banking callback is missing the authorization code";
}

const CONSENT_VALIDITY_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PSU_TYPE = "personal";

const closeConnection = (request: ConnectionRequest) =>
  ebDeleteIfPresent(
    "session deletion",
    `/sessions/${encodeURIComponent(request.providerSessionId)}`
  );

const completeConnection = Effect.fn("enableBanking.completeConnection")(
  function* completeConnection(request: CompleteConnectionRequest) {
    const { code } = request.callbackParams;

    if (!code) {
      return yield* new EnableBankingCallbackIncomplete();
    }

    const session = yield* ebJson(
      "session",
      EBCompletedConnectionSchema,
      "/sessions",
      { body: JSON.stringify({ code }), method: "POST" }
    );

    return mapEBCompletedConnection(session);
  }
);

const fetchTransactions = Effect.fn("enableBanking.fetchTransactions")(
  function* fetchTransactions(request: FetchTransactionsRequest) {
    const raw = yield* fetchTransactionPages(
      request.providerAccountId,
      request.dateFrom,
      request.dateTo
    );

    return mapEBTransactions(raw, request.dateTo);
  }
);

const listInstitutions = Effect.fn("enableBanking.listInstitutions")(
  function* listInstitutions(country: string) {
    const listed = yield* Effect.mapError(
      ebJson(
        "institutions",
        EBInstitutionsSchema,
        `/aspsps?country=${encodeURIComponent(country)}`
      ),
      () => new BankInstitutionsUnavailable({ country })
    );

    return listed.aspsps.map((aspsp) => ({
      bic: aspsp.bic ?? undefined,
      country: aspsp.country,
      group: aspsp.group ?? undefined,
      id: aspsp.name,
      logoUrl: aspsp.logo ?? undefined,
      name: aspsp.name,
    }));
  }
);

const startConnection = Effect.fn("enableBanking.startConnection")(
  function* startConnection(request: StartConnectionRequest) {
    const authorized = yield* ebJson("auth", EBAuthorizationSchema, "/auth", {
      body: JSON.stringify({
        access: {
          valid_until: new Date(
            Date.now() + CONSENT_VALIDITY_DAYS * MILLISECONDS_PER_DAY
          ).toISOString(),
        },
        aspsp: { country: request.country, name: request.institutionId },
        psu_type: PSU_TYPE,
        redirect_url: request.redirectUrl,
        state: request.state,
      }),
      method: "POST",
    });

    return { url: authorized.url };
  }
);

export const enableBankingProvider: BankingProvider = {
  callbackPath: "/callback/enable-banking",
  closeConnection: (request) => Effect.runPromise(closeConnection(request)),
  completeConnection: (request) =>
    Effect.runPromise(completeConnection(request)),
  fetchTransactions: (request) => Effect.runPromise(fetchTransactions(request)),
  id: "enable-banking",
  isConfigured,
  listInstitutions,
  startConnection: (request) => Effect.runPromise(startConnection(request)),
};
