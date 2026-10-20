import { Data, Effect, Match } from "effect";

import { BankInstitutionsUnavailable } from "../types";
import type {
  BankingProvider,
  CompleteConnectionRequest,
  ConnectionRequest,
  FetchHoldingsRequest,
  FetchTransactionsRequest,
  ProviderUserSession,
  StartConnectionRequest,
} from "../types";
import type { PowensConnector } from "./client";
import {
  PowensConnectionSchema,
  PowensConnectorsSchema,
  PowensInvestmentsSchema,
  PowensUserSchema,
  PowensWebviewCodeSchema,
  currencyOf,
  fetchTransactionPages,
  getAccount,
  isConfigured,
  powensDeleteIfPresent,
  powensHost,
  powensJson,
  precisionOf,
  requireCredentials,
} from "./client";
import { mapPowensAccount } from "./map-account";
import { mapPowensConnection } from "./map-connection";
import { mapPowensInvestments } from "./map-holding";
import { mapPowensTransactions } from "./map-transaction";

type PowensConnectionUnusableReason =
  | { readonly kind: "sessionMissing" }
  | { readonly kind: "callbackIncomplete" }
  | { readonly kind: "needsUserAction"; readonly state: string };

export class PowensConnectionUnusable extends Data.TaggedError(
  "PowensConnectionUnusable"
)<{
  readonly reason: PowensConnectionUnusableReason;
}> {
  override get message(): string {
    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        callbackIncomplete: () =>
          "Powens callback is missing the connection id",
        needsUserAction: ({ state }) =>
          `Powens connection needs the user's attention (${state})`,
        sessionMissing: () => "Powens needs a provider user session",
      })
    );
  }
}

const CONNECTION_ID = /^\d+$/u;
const WEBVIEW_CONNECT_URL = "https://webview.powens.com/connect";
const FALLBACK_CURRENCY = "EUR";
const DAY_START = "00:00:00";
const CONNECTION_WITH_ACCOUNTS = "accounts";
const CONNECTION_WITH_ACCOUNTS_AND_CONNECTOR = "accounts,connector";

const STATES_ONLY_THE_ACCOUNT_HOLDER_CAN_CLEAR = {
  SCARequired: true,
  actionNeeded: true,
  additionalInformationNeeded: true,
  decoupled: true,
  passwordExpired: true,
  webauthRequired: true,
  wrongpass: true,
} satisfies Record<string, true>;

const BANK_DATA_PRODUCTS = { bank: true, wealth: true } satisfies Record<
  string,
  true
>;

const requireUser = (
  user: ProviderUserSession | null
): Effect.Effect<ProviderUserSession, PowensConnectionUnusable> =>
  Effect.fromNullishOr(user).pipe(
    Effect.mapError(
      () => new PowensConnectionUnusable({ reason: { kind: "sessionMissing" } })
    )
  );

const getConnection = (
  user: ProviderUserSession,
  providerSessionId: string,
  expand: string
) =>
  powensJson(
    "connection",
    PowensConnectionSchema,
    `/users/me/connections/${encodeURIComponent(providerSessionId)}?expand=${expand}`,
    { token: user.accessToken }
  );

const offersBankData = (connector: PowensConnector): boolean =>
  !(connector.hidden || connector.restricted) &&
  (connector.products ?? []).some((product) =>
    Object.hasOwn(BANK_DATA_PRODUCTS, product)
  );

const closeConnection = Effect.fn("powens.closeConnection")(
  function* closeConnection(request: ConnectionRequest) {
    const user = yield* requireUser(request.user);

    yield* powensDeleteIfPresent(
      "connection deletion",
      `/users/me/connections/${encodeURIComponent(request.providerSessionId)}`,
      user.accessToken
    );
  }
);

const completeConnection = Effect.fn("powens.completeConnection")(
  function* completeConnection(request: CompleteConnectionRequest) {
    const user = yield* requireUser(request.user);
    const connectionId = request.callbackParams.connection_id;

    if (!(connectionId && CONNECTION_ID.test(connectionId))) {
      return yield* new PowensConnectionUnusable({
        reason: { kind: "callbackIncomplete" },
      });
    }

    const connection = yield* getConnection(
      user,
      connectionId,
      CONNECTION_WITH_ACCOUNTS_AND_CONNECTOR
    );

    return mapPowensConnection(connection);
  }
);

const createUser = Effect.fn("powens.createUser")(function* createUser() {
  const { clientId, clientSecret } = yield* requireCredentials("user creation");
  const created = yield* powensJson(
    "user creation",
    PowensUserSchema,
    "/auth/init",
    {
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
      method: "POST",
    }
  );

  return {
    accessToken: created.auth_token,
    providerUserId: String(created.id_user),
  };
});

const fetchAccounts = Effect.fn("powens.fetchAccounts")(function* fetchAccounts(
  request: ConnectionRequest
) {
  const user = yield* requireUser(request.user);
  const connection = yield* getConnection(
    user,
    request.providerSessionId,
    CONNECTION_WITH_ACCOUNTS
  );

  const { state } = connection;

  if (state && Object.hasOwn(STATES_ONLY_THE_ACCOUNT_HOLDER_CAN_CLEAR, state)) {
    return yield* new PowensConnectionUnusable({
      reason: { kind: "needsUserAction", state },
    });
  }

  return (connection.accounts ?? []).flatMap((account) =>
    account.deleted ? [] : [mapPowensAccount(account)]
  );
});

const fetchHoldings = Effect.fn("powens.fetchHoldings")(function* fetchHoldings(
  request: FetchHoldingsRequest
) {
  const user = yield* requireUser(request.user);
  const account = yield* getAccount(
    user.accessToken,
    request.providerAccountId
  );

  const held = yield* powensJson(
    "investments",
    PowensInvestmentsSchema,
    `/users/me/accounts/${encodeURIComponent(request.providerAccountId)}/investments`,
    { token: user.accessToken }
  );

  return mapPowensInvestments(
    held.investments ?? [],
    currencyOf(account) ?? FALLBACK_CURRENCY,
    precisionOf(account)
  );
});

const fetchTransactions = Effect.fn("powens.fetchTransactions")(
  function* fetchTransactions(request: FetchTransactionsRequest) {
    const user = yield* requireUser(request.user);
    const account = yield* getAccount(
      user.accessToken,
      request.providerAccountId
    );

    const raw = yield* fetchTransactionPages(
      user.accessToken,
      request.providerAccountId,
      `${request.dateFrom} ${DAY_START}`
    );

    return mapPowensTransactions(
      raw,
      currencyOf(account) ?? FALLBACK_CURRENCY,
      precisionOf(account)
    );
  }
);

const listInstitutions = Effect.fn("powens.listInstitutions")(
  function* listInstitutions(country: string) {
    const listed = yield* Effect.mapError(
      powensJson(
        "connectors",
        PowensConnectorsSchema,
        `/connectors?country_codes=${encodeURIComponent(country)}`
      ),
      () => new BankInstitutionsUnavailable({ country })
    );

    return (listed.connectors ?? []).flatMap((connector) =>
      offersBankData(connector)
        ? [
            {
              country,
              id: connector.uuid,
              name: connector.name ?? connector.uuid,
            },
          ]
        : []
    );
  }
);

const startConnection = Effect.fn("powens.startConnection")(
  function* startConnection(request: StartConnectionRequest) {
    const user = yield* requireUser(request.user);
    const { clientId, domain } = yield* requireCredentials("webview code");
    const single = yield* powensJson(
      "webview code",
      PowensWebviewCodeSchema,
      "/auth/token/code?type=singleAccess",
      { token: user.accessToken }
    );

    const params = new URLSearchParams({
      client_id: clientId,
      code: single.code,
      connector_uuids: request.institutionId,
      domain: powensHost(domain),
      redirect_uri: request.redirectUrl,
      state: request.state,
    });

    return { url: `${WEBVIEW_CONNECT_URL}?${params.toString()}` };
  }
);

export const powensProvider: BankingProvider = {
  callbackPath: "/callback/powens",
  closeConnection: (request) => Effect.runPromise(closeConnection(request)),
  completeConnection: (request) =>
    Effect.runPromise(completeConnection(request)),
  createUser: () => Effect.runPromise(createUser()),
  deleteUser: (user) =>
    Effect.runPromise(
      powensDeleteIfPresent("user deletion", "/users/me", user.accessToken)
    ),
  fetchAccounts: (request) => Effect.runPromise(fetchAccounts(request)),
  fetchHoldings: (request) => Effect.runPromise(fetchHoldings(request)),
  fetchTransactions: (request) => Effect.runPromise(fetchTransactions(request)),
  id: "powens",
  isConfigured,
  listInstitutions,
  startConnection: (request) => Effect.runPromise(startConnection(request)),
};
