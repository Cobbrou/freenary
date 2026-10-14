import { settings } from "@freenary/instance-config";
import { Data, Effect, Match, Option, Schema } from "effect";

export interface PowensCredentials {
  clientId: string;
  clientSecret: string;
  domain: string;
}

export interface PowensRequest {
  token?: string;
  method?: string;
  body?: string;
}

type PowensRequestReason =
  | { readonly kind: "missingCredentials" }
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string };

export class PowensRequestFailed extends Data.TaggedError(
  "PowensRequestFailed"
)<{
  readonly operation: string;
  readonly reason: PowensRequestReason;
}> {
  override get message(): string {
    const { operation } = this;

    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        missingCredentials: () => "Powens is not configured",
        rejected: ({ body, status }) =>
          `Powens ${operation} failed: ${status} ${body}`,
        undecodable: ({ detail }) =>
          `Powens ${operation} response does not match the documented shape: ${detail}`,
        unreachable: ({ detail }) => `Powens ${operation} failed: ${detail}`,
      })
    );
  }
}

const DOMAIN_SUFFIX = /\.biapi\.pro\/?$/u;

const POWENS_UTC_DATETIME =
  /^(?<date>\d{4}-\d{2}-\d{2})[ T](?<time>\d{2}:\d{2}:\d{2})/u;

export const POWENS_API_PATH = "/2.0";
const NOT_FOUND = 404;
const MAX_TRANSACTIONS_PER_PAGE = 1000;
const DEFAULT_CURRENCY_PRECISION = 2;

export const powensHost = (domain: string): string =>
  `${domain.trim().replace(DOMAIN_SUFFIX, "")}.biapi.pro`;

const readCredentials = (): Option.Option<PowensCredentials> => {
  const domain = settings.POWENS_DOMAIN;
  const clientId = settings.POWENS_CLIENT_ID;
  const clientSecret = settings.POWENS_CLIENT_SECRET;

  return domain && clientId && clientSecret
    ? Option.some({ clientId, clientSecret, domain })
    : Option.none();
};

export const isConfigured = (): boolean => Option.isSome(readCredentials());

export const requireCredentials = (
  operation: string
): Effect.Effect<PowensCredentials, PowensRequestFailed> =>
  Effect.suspend(() =>
    Option.match(readCredentials(), {
      onNone: () =>
        Effect.fail(
          new PowensRequestFailed({
            operation,
            reason: { kind: "missingCredentials" },
          })
        ),
      onSome: Effect.succeed,
    })
  );

const powensHeaders = (token: string | undefined): Headers => {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
};

const powensUrl = Effect.fnUntraced(function* powensUrl(
  operation: string,
  path: string
) {
  const { domain } = yield* requireCredentials(operation);

  return `https://${powensHost(domain)}${POWENS_API_PATH}${path}`;
});

const send = Effect.fnUntraced(function* send(
  operation: string,
  url: string,
  request: PowensRequest
) {
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new PowensRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: (signal) =>
      fetch(url, {
        body: request.body,
        headers: powensHeaders(request.token),
        method: request.method,
        signal,
      }),
  });
});

const failRejected = Effect.fnUntraced(function* failRejected(
  operation: string,
  response: Response
) {
  const body = yield* Effect.tryPromise({
    catch: (cause) =>
      new PowensRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: () => response.text(),
  });

  return yield* new PowensRequestFailed({
    operation,
    reason: { body, kind: "rejected", status: response.status },
  });
});

const requestJson = Effect.fn("powens.requestJson")(function* requestJson<
  S extends Schema.ConstraintDecoder<unknown>,
>(operation: string, schema: S, url: string, request: PowensRequest) {
  const response = yield* send(operation, url, request);

  if (!response.ok) {
    return yield* failRejected(operation, response);
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new PowensRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(schema)(payload).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new PowensRequestFailed({
          operation,
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

export const powensJson = Effect.fnUntraced(function* powensJson<
  S extends Schema.ConstraintDecoder<unknown>,
>(operation: string, schema: S, path: string, request: PowensRequest = {}) {
  const url = yield* powensUrl(operation, path);

  return yield* requestJson(operation, schema, url, request);
});

export const powensDeleteIfPresent = Effect.fn("powens.deleteIfPresent")(
  function* powensDeleteIfPresent(
    operation: string,
    path: string,
    token: string
  ) {
    const url = yield* powensUrl(operation, path);
    const response = yield* send(operation, url, { method: "DELETE", token });

    if (response.ok || response.status === NOT_FOUND) {
      return;
    }

    return yield* failRejected(operation, response);
  }
);

const NullableString = Schema.optional(Schema.NullOr(Schema.String));
const NullableNumber = Schema.optional(Schema.NullOr(Schema.Number));
const NullableBoolean = Schema.optional(Schema.NullOr(Schema.Boolean));

export const PowensCurrencySchema = Schema.Struct({
  id: NullableString,
  precision: NullableNumber,
});

export const PowensConnectorSchema = Schema.Struct({
  beta: NullableBoolean,
  capabilities: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  hidden: NullableBoolean,
  id: Schema.optional(Schema.Number),
  name: NullableString,
  products: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  restricted: NullableBoolean,
  uuid: Schema.String,
});

export const PowensConnectorsSchema = Schema.Struct({
  connectors: Schema.optional(Schema.Array(PowensConnectorSchema)),
});

const PowensAccountTypeSchema = Schema.Union([
  Schema.String,
  Schema.Struct({ name: NullableString }),
]);

export const PowensAccountSchema = Schema.Struct({
  balance: NullableNumber,
  coming: NullableNumber,
  currency: Schema.optional(Schema.NullOr(PowensCurrencySchema)),
  deleted: NullableString,
  disabled: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.String, Schema.Boolean]))
  ),
  iban: NullableString,
  id: Schema.Number,
  last_update: NullableString,
  name: NullableString,
  number: NullableString,
  original_name: NullableString,
  type: Schema.optional(Schema.NullOr(PowensAccountTypeSchema)),
});

export const PowensConnectionSchema = Schema.Struct({
  accounts: Schema.optional(Schema.NullOr(Schema.Array(PowensAccountSchema))),
  connector: Schema.optional(
    Schema.NullOr(Schema.Struct({ name: NullableString, uuid: NullableString }))
  ),
  id: Schema.Number,
  state: NullableString,
});

const PowensCounterpartySchema = Schema.Struct({
  account_identification: NullableString,
  account_scheme_name: NullableString,
  label: NullableString,
  type: NullableString,
});

export const PowensTransactionSchema = Schema.Struct({
  active: NullableBoolean,
  coming: NullableBoolean,
  comment: NullableString,
  counterparty: Schema.optional(Schema.NullOr(PowensCounterpartySchema)),
  date: NullableString,
  deleted: NullableString,
  id: Schema.Number,
  id_account: Schema.optional(Schema.Number),
  original_currency: Schema.optional(Schema.NullOr(PowensCurrencySchema)),
  original_wording: NullableString,
  rdate: NullableString,
  simplified_wording: NullableString,
  type: NullableString,
  value: NullableNumber,
  vdate: NullableString,
  wording: NullableString,
});

const PowensTransactionPageSchema = Schema.Struct({
  _links: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        next: Schema.optional(
          Schema.NullOr(Schema.Struct({ href: NullableString }))
        ),
      })
    )
  ),
  transactions: Schema.optional(
    Schema.NullOr(Schema.Array(PowensTransactionSchema))
  ),
});

export const PowensInvestmentSchema = Schema.Struct({
  code: NullableString,
  code_type: NullableString,
  deleted: NullableString,
  diff: NullableNumber,
  diff_percent: NullableNumber,
  id: Schema.Number,
  id_account: Schema.optional(Schema.Number),
  label: NullableString,
  last_update: NullableString,
  original_currency: Schema.optional(Schema.NullOr(PowensCurrencySchema)),
  quantity: NullableNumber,
  unitprice: NullableNumber,
  unitvalue: NullableNumber,
  valuation: NullableNumber,
  vdate: NullableString,
});

export const PowensInvestmentsSchema = Schema.Struct({
  investments: Schema.optional(Schema.Array(PowensInvestmentSchema)),
});

export const PowensUserSchema = Schema.Struct({
  auth_token: Schema.String,
  id_user: Schema.Number,
});

export const PowensWebviewCodeSchema = Schema.Struct({ code: Schema.String });

export const isReported = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

export const toMinorUnits = (value: number, precision: number): number =>
  Math.round(value * 10 ** precision);

export const precisionOf = (account: PowensAccount): number =>
  account.currency?.precision ?? DEFAULT_CURRENCY_PRECISION;

export const currencyOf = (account: PowensAccount): string | undefined =>
  account.currency?.id ?? undefined;

export const toIsoDateTime = (
  value: string | null | undefined
): string | undefined => {
  const groups = value?.match(POWENS_UTC_DATETIME)?.groups;

  return groups ? `${groups.date}T${groups.time}Z` : undefined;
};

export const getAccount = (
  token: string,
  accountId: string
): Effect.Effect<PowensAccount, PowensRequestFailed> =>
  powensJson(
    "account",
    PowensAccountSchema,
    `/users/me/accounts/${encodeURIComponent(accountId)}`,
    { token }
  );

export const fetchTransactionPages = Effect.fn("powens.fetchTransactionPages")(
  function* fetchTransactionPages(
    token: string,
    accountId: string,
    lastUpdate: string
  ) {
    const collected: PowensTransaction[] = [];
    const firstPage = yield* powensUrl(
      "transactions",
      `/users/me/accounts/${encodeURIComponent(accountId)}/transactions?limit=${MAX_TRANSACTIONS_PER_PAGE}&last_update=${encodeURIComponent(lastUpdate)}`
    );

    let nextPage: string | undefined = firstPage;

    while (nextPage) {
      const page: PowensTransactionPage = yield* requestJson(
        "transactions",
        PowensTransactionPageSchema,
        nextPage,
        { token }
      );

      collected.push(...(page.transactions ?? []));
      nextPage = page._links?.next?.href ?? undefined;
    }

    return collected;
  }
);

export type PowensCurrency = typeof PowensCurrencySchema.Type;

export type PowensConnector = typeof PowensConnectorSchema.Type;

export type PowensAccountType = typeof PowensAccountTypeSchema.Type;

export type PowensAccount = typeof PowensAccountSchema.Type;

export type PowensConnection = typeof PowensConnectionSchema.Type;

export type PowensCounterparty = typeof PowensCounterpartySchema.Type;

export type PowensTransaction = typeof PowensTransactionSchema.Type;

export type PowensInvestment = typeof PowensInvestmentSchema.Type;

type PowensTransactionPage = typeof PowensTransactionPageSchema.Type;
