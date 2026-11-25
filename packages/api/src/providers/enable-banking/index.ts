import { Data, Effect, Option, Schema } from "effect";

import { BankInstitutionsUnavailable } from "../types";
import type {
  BankingProvider,
  CompleteConnectionRequest,
  ConnectionRequest,
  FetchTransactionsRequest,
  StartConnectionRequest,
} from "../types";
import {
  EBAccountDetailsSchema,
  EBAuthorizationSchema,
  EBBalancesSchema,
  EBCompletedConnectionSchema,
  EBInstitutionsSchema,
  EnableBankingRequestFailed,
  EBSessionSchema,
  ebDeleteIfPresent,
  ebJson,
  fetchTransactionPages,
  isConfigured,
} from "./client";
import { mapEBAccount, mapEBCompletedConnection } from "./map-connection";
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

const ENDED_SESSION_ERRORS = {
  CLOSED_SESSION: true,
  EXPIRED_SESSION: true,
  REVOKED_SESSION: true,
} satisfies Record<string, true>;

const decodeErrorBody = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ error: Schema.String }))
);

const needsReconnect = (cause: unknown): boolean =>
  cause instanceof EnableBankingRequestFailed &&
  cause.reason.kind === "rejected" &&
  Option.exists(decodeErrorBody(cause.reason.body), ({ error }) =>
    Object.hasOwn(ENDED_SESSION_ERRORS, error)
  );

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

    return mapEBTransactions(raw, request.dateTo, request.accountCurrency);
  }
);

const fetchAccount = Effect.fn("enableBanking.fetchAccount")(
  function* fetchAccount(uid: string) {
    const account = encodeURIComponent(uid);
    const details = yield* ebJson(
      "account details",
      EBAccountDetailsSchema,
      `/accounts/${account}/details`
    );

    const balances = yield* ebJson(
      "balances",
      EBBalancesSchema,
      `/accounts/${account}/balances`
    ).pipe(
      Effect.map((listed) => listed.balances ?? []),
      Effect.tapError((failure) =>
        Effect.logWarning("Enable Banking balances unavailable", failure)
      ),
      Effect.option,
      Effect.map(Option.getOrNull)
    );

    return mapEBAccount(uid, details, balances);
  }
);

const fetchAccounts = Effect.fn("enableBanking.fetchAccounts")(
  function* fetchAccounts(request: ConnectionRequest) {
    const session = yield* ebJson(
      "session",
      EBSessionSchema,
      `/sessions/${encodeURIComponent(request.providerSessionId)}`
    );

    return yield* Effect.all(
      (session.accounts ?? []).map((uid) => fetchAccount(uid))
    );
  }
);

const listInstitutions = Effect.fn("enableBanking.listInstitutions")(
  function* listInstitutions() {
    const listed = yield* Effect.mapError(
      ebJson("institutions", EBInstitutionsSchema, "/aspsps"),
      (cause) => new BankInstitutionsUnavailable({ cause })
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
  fetchAccounts: (request) => Effect.runPromise(fetchAccounts(request)),
  fetchTransactions: (request) => Effect.runPromise(fetchTransactions(request)),
  id: "enable-banking",
  isConfigured,
  listInstitutions,
  needsReconnect,
  startConnection: (request) => Effect.runPromise(startConnection(request)),
};
