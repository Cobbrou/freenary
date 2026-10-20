import { createSign } from "node:crypto";

import { settings } from "@freenary/instance-config";
import { Data, Effect, Match, Option, Schema } from "effect";

export interface EnableBankingCredentials {
  appId: string;
  privateKey: string;
}

type EnableBankingRequestReason =
  | { readonly kind: "missingCredentials" }
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string };

export class EnableBankingRequestFailed extends Data.TaggedError(
  "EnableBankingRequestFailed"
)<{
  readonly operation: string;
  readonly reason: EnableBankingRequestReason;
}> {
  override get message(): string {
    const { operation } = this;

    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        missingCredentials: () => "Enable Banking is not configured",
        rejected: ({ body, status }) =>
          `Enable Banking ${operation} failed: ${status} ${body}`,
        undecodable: ({ detail }) =>
          `Enable Banking ${operation} response does not match the documented shape: ${detail}`,
        unreachable: ({ detail }) =>
          `Enable Banking ${operation} failed: ${detail}`,
      })
    );
  }
}

export const ENABLE_BANKING_ORIGIN = "https://api.enablebanking.com";
const JWT_AUDIENCE = "api.enablebanking.com";
const JWT_ISSUER = "enablebanking.com";
const JWT_LIFETIME_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;
export const LITERAL_NEWLINE_ESCAPE = "\\n";
const LONGEST_HISTORY_STRATEGY = "longest";
const NOT_FOUND = 404;

const base64url = (payload: Buffer | string): string => {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);

  return buf.toString("base64url");
};

export const createJwt = (appId: string, privateKey: string): string => {
  const header = base64url(
    JSON.stringify({ alg: "RS256", kid: appId, typ: "JWT" })
  );

  const issuedAt = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const payload = base64url(
    JSON.stringify({
      aud: JWT_AUDIENCE,
      exp: issuedAt + JWT_LIFETIME_SECONDS,
      iat: issuedAt,
      iss: JWT_ISSUER,
      sub: appId,
    })
  );

  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
};

const readCredentials = (): Option.Option<EnableBankingCredentials> => {
  const appId = settings.ENABLE_BANKING_APP_ID;
  const rawKey = settings.ENABLE_BANKING_PRIVATE_KEY;

  return appId && rawKey
    ? Option.some({
        appId,
        privateKey: rawKey.replaceAll(LITERAL_NEWLINE_ESCAPE, "\n"),
      })
    : Option.none();
};

export const isConfigured = (): boolean => Option.isSome(readCredentials());

const requireCredentials = (
  operation: string
): Effect.Effect<EnableBankingCredentials, EnableBankingRequestFailed> =>
  Effect.suspend(() =>
    Option.match(readCredentials(), {
      onNone: () =>
        Effect.fail(
          new EnableBankingRequestFailed({
            operation,
            reason: { kind: "missingCredentials" },
          })
        ),
      onSome: Effect.succeed,
    })
  );

const send = Effect.fnUntraced(function* send(
  operation: string,
  path: string,
  init: RequestInit
) {
  const { appId, privateKey } = yield* requireCredentials(operation);
  const token = createJwt(appId, privateKey);

  return yield* Effect.tryPromise({
    catch: (cause) =>
      new EnableBankingRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: (signal) =>
      fetch(`${ENABLE_BANKING_ORIGIN}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
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
      new EnableBankingRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: () => response.text(),
  });

  return yield* new EnableBankingRequestFailed({
    operation,
    reason: { body, kind: "rejected", status: response.status },
  });
});

export const ebJson = Effect.fn("enableBanking.json")(function* ebJson<
  S extends Schema.ConstraintDecoder<unknown>,
>(operation: string, schema: S, path: string, init: RequestInit = {}) {
  const response = yield* send(operation, path, init);

  if (!response.ok) {
    return yield* failRejected(operation, response);
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new EnableBankingRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(schema)(payload).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new EnableBankingRequestFailed({
          operation,
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

export const ebDeleteIfPresent = Effect.fn("enableBanking.deleteIfPresent")(
  function* ebDeleteIfPresent(operation: string, path: string) {
    const response = yield* send(operation, path, { method: "DELETE" });

    if (response.ok || response.status === NOT_FOUND) {
      return;
    }

    return yield* failRejected(operation, response);
  }
);

const OptionalString = Schema.optional(Schema.String);

const EBAmountSchema = Schema.Struct({
  amount: OptionalString,
  currency: OptionalString,
});

export const EBCreditorIdentificationSchema = Schema.Struct({
  identification: OptionalString,
  scheme_name: OptionalString,
});

export const EBTransactionSchema = Schema.Struct({
  balance_after_transaction: Schema.optional(EBAmountSchema),
  bank_transaction_code: Schema.optional(
    Schema.Struct({
      code: OptionalString,
      description: OptionalString,
      sub_code: OptionalString,
    })
  ),
  booking_date: OptionalString,
  credit_debit_indicator: OptionalString,
  creditor: Schema.optional(
    Schema.Struct({
      name: OptionalString,
      postal_address: Schema.optional(
        Schema.Struct({ country: OptionalString, town_name: OptionalString })
      ),
    })
  ),
  creditor_account: Schema.optional(Schema.Struct({ iban: OptionalString })),
  creditor_account_additional_identification: Schema.optional(
    Schema.Union([
      EBCreditorIdentificationSchema,
      Schema.Array(EBCreditorIdentificationSchema),
    ])
  ),
  creditor_agent: Schema.optional(Schema.Struct({ bic_fi: OptionalString })),
  debtor: Schema.optional(Schema.Struct({ name: OptionalString })),
  debtor_account: Schema.optional(Schema.Struct({ iban: OptionalString })),
  entry_reference: OptionalString,
  exchange_rate: Schema.optional(
    Schema.Struct({ exchange_rate: OptionalString })
  ),
  merchant_category_code: OptionalString,
  note: OptionalString,
  reference_number: OptionalString,
  reference_number_schema: OptionalString,
  remittance_information: Schema.optional(
    Schema.mutable(Schema.Array(Schema.String))
  ),
  status: OptionalString,
  transaction_amount: Schema.optional(EBAmountSchema),
  transaction_date: OptionalString,
  transaction_id: OptionalString,
  value_date: OptionalString,
});

const EBTransactionPageSchema = Schema.Struct({
  continuation_key: OptionalString,
  transactions: Schema.optional(Schema.Array(EBTransactionSchema)),
});

export const EBInstitutionsSchema = Schema.Struct({
  aspsps: Schema.Array(
    Schema.Struct({
      bic: Schema.optional(Schema.NullOr(Schema.String)),
      country: Schema.String,
      group: Schema.optional(Schema.NullOr(Schema.String)),
      logo: Schema.optional(Schema.NullOr(Schema.String)),
      name: Schema.String,
    })
  ),
});

export const EBAuthorizationSchema = Schema.Struct({ url: Schema.String });

export const EBCompletedConnectionSchema = Schema.Struct({
  accounts: Schema.Array(
    Schema.Struct({
      account_id: Schema.optional(
        Schema.Struct({
          iban: OptionalString,
          identification_hash: OptionalString,
        })
      ),
      name: OptionalString,
      uid: Schema.String,
    })
  ),
  aspsp: Schema.optional(
    Schema.Struct({ group: OptionalString, name: OptionalString })
  ),
  session_id: Schema.String,
});

export const fetchTransactionPages = Effect.fn(
  "enableBanking.fetchTransactionPages"
)(function* fetchTransactionPages(
  accountId: string,
  dateFrom: string,
  dateTo: string
) {
  const collected: EBTransaction[] = [];
  const account = encodeURIComponent(accountId);
  let continuationKey: string | undefined;
  let isFirstPage = true;

  do {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });

    if (isFirstPage) {
      params.set("strategy", LONGEST_HISTORY_STRATEGY);
      isFirstPage = false;
    }

    if (continuationKey) {
      params.set("continuation_key", continuationKey);
    }

    const page = yield* ebJson(
      "transactions",
      EBTransactionPageSchema,
      `/accounts/${account}/transactions?${params.toString()}`
    );

    collected.push(...(page.transactions ?? []));
    continuationKey = page.continuation_key;
  } while (continuationKey);

  return collected;
});

export type EBCreditorIdentification =
  typeof EBCreditorIdentificationSchema.Type;

export type EBTransaction = typeof EBTransactionSchema.Type;

export type EBCompletedConnection = typeof EBCompletedConnectionSchema.Type;
