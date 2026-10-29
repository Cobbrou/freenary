# Add a bank provider

The BankingProvider members, the registry, what an optional member costs, the callback path and how to test with no credentials.

A bank provider adapter is one object that satisfies the `BankingProvider` interface. It translates one aggregation API into the shapes the core understands, and it does nothing else. Three adapters ship: Powens, Enable Banking, and `mock`, which exists only outside production.

The interface lives in [`packages/api/src/providers/types.ts`](https://github.com/suiramdev/freenary/blob/main/packages/api/src/providers/types.ts). Read that file for the exact field list, and read this file for the contract each member owes its caller.

## The shipped adapters

Operator-facing setup lives in [Bank providers](../../apps/fumadocs/content/docs/next/reference/bank-providers.mdx). What follows is how each adapter talks to its API.

### Powens

| Detail | Value |
| --- | --- |
| API host | `https://<POWENS_DOMAIN>.biapi.pro/2.0` |
| Consent screen | `https://webview.powens.com/connect` |
| Domain normalisation | The value is trimmed, a trailing `.biapi.pro` (and optional `/`) is stripped, then `.biapi.pro` is appended. The match is case-sensitive, and a value that starts with `https://` is not normalised |
| Connector filter | A connector marked `hidden` or `restricted` is dropped. One whose products hold `bank` or `wealth` is kept |
| Per-user identity | `POST /auth/init` mints one token per user. The core stores it in `bank_provider_user` and deletes the row when the user holds no Powens connection left |

### Enable Banking

| Detail | Value |
| --- | --- |
| API host | `https://api.enablebanking.com`, hard-coded |
| Consent screen | The URL the provider returns |
| Consent window | `valid_until` 90 days ahead. A bank can grant less, and a shortened consent is not tracked |
| Private key | Every literal `\n` becomes a newline before signing, so a one-line PEM works. A multi-line PEM works too. No passphrase, and no format check |

Every call carries a fresh JSON Web Token as a bearer token:

| Part      | Value                    |
| --------- | ------------------------ |
| Algorithm | `RS256`                  |
| `kid`     | `ENABLE_BANKING_APP_ID`  |
| `aud`     | `api.enablebanking.com`  |
| `iss`     | `enablebanking.com`      |
| `sub`     | `ENABLE_BANKING_APP_ID`  |
| `exp`     | 3600 seconds after `iat` |

### Credentials from the setup screen

Saving a bank variant through the setup screen writes `null` for every key of the `banking` integration that the chosen variant does not use (`packages/api/src/instance/merge.ts › writesOf`). Stored credentials of the other adapter are therefore erased, and its existing connections can no longer sync or disconnect. Credentials held in the environment are untouched.

### Mock

| Detail | Value |
| --- | --- |
| Credentials | None. `isConfigured` is always `true` |
| Institutions | Three made-up banks from `mock/catalog.ts`, listed for every country |
| Consent screen | `MOCK_CONSENT_PATH` (`/mock-bank/consent`), a page `handleMockConsent` serves from `apps/server/src/index.ts`. It refuses a `redirect_uri` other than `CORS_ORIGIN` joined to `/callback/mock`, and answers 404 when `NODE_ENV` is `production` |
| Session code | `mock_<YYYY-MM-DD>_<uuid>`, from `mock/session.ts › mockSessionCode`. The day is the consent day; `openedOnOf` parses it, and `completeConnection` refuses a code it cannot parse |
| Generated data | `mock/generate.ts` seeds a fresh Faker per key (session, account, day), so a day's transactions and their ids are the same on every sync. The balance ledger starts 90 days before the consent day, so a balance moves only by the transactions booked since |
| Production exclusion | The env schema refuses `BANKING_PROVIDER=mock`, `integrations.ts` adds no `mock` setup variant, and `registry.ts` registers the adapter only when `NODE_ENV` is not `production` |

`mock/index.ts › mockProvider` loads `./generate`, and with it `@faker-js/faker`, through a dynamic `import()` inside `completeConnection` and the `fetch*` members. Importing the adapter therefore never loads Faker.

## The registry

`packages/api/src/providers/registry.ts` is the whole selection logic. It holds a map keyed by the `id` of each adapter. `getProvider(id)` returns the entry and throws `Unknown banking provider: ${id}` on a miss. `getDefaultProvider()` is `getProvider(env.BANKING_PROVIDER)`.

`BANKING_PROVIDER` picks the adapter for a **new** bank connection. Every `bank_connection` row keeps its own `provider` column, so a sync and a disconnect resolve the adapter per row. Two adapters can hold live connections at the same time.

## The members

Twelve members, eight of them required. The adapter never touches Prisma: `packages/api/src/lib/bank-provider-user.ts` owns the per-user identity row, and `packages/api/src/lib/bank-sync.ts` owns every write.

| Member | Required | Input | Returns | What the caller does with it |
| --- | --- | --- | --- | --- |
| `id` | yes, `readonly` | none | a stable lower-case string | The registry key, and the value of `bank_connection.provider` |
| `callbackPath` | yes, `readonly` | none | a path typed `` `/callback/${string}` `` | `startConnection` builds the redirect URL from `CORS_ORIGIN` and this path |
| `isConfigured` | yes | none | a boolean | `bankConnection.getProviderAvailability` gates the settings section and the onboarding bank step. Never call the network here |
| `listInstitutions` | yes | one ISO 3166-1 alpha-2 country | an `Effect` of provider institutions, which can fail with `BankInstitutionsUnavailable` | The bank picker, and the exact match on the pair of id and country at start and at exchange |
| `startConnection` | yes | a start request | a promise of one `url` | The web app sends the browser to that URL |
| `completeConnection` | yes | the callback parameters and the user session | a promise of one completed connection | `exchangeCode` writes the connection row and one account row per account |
| `closeConnection` | yes | a connection request | a promise of nothing | `disconnect` calls it before it deletes the local rows |
| `fetchTransactions` | yes | a connection request plus an account id and a day range | a promise of provider transactions | `upsertTransaction` writes each one and derives its merchant key |
| `createUser` | **optional** | none | a promise of one provider user session | `ensureProviderUser` inserts one row per pair of user and provider, and it tolerates a concurrent duplicate |
| `deleteUser` | **optional** | a provider user session | a promise of nothing | `releaseProviderUser` calls it when the last connection of that user for that provider goes away |
| `fetchAccounts` | **optional** | a connection request | a promise of provider accounts | `syncProviderAccounts` upserts on the pair of connection and provider account id |
| `fetchHoldings` | **optional** | a connection request plus an account id | a promise of provider holdings | `syncHoldings` replaces the snapshot of that account |

### The shapes the core hands you

| Shape | Fields |
| --- | --- |
| Start request | `institutionId`, `country`, `redirectUrl`, `state`, `user` |
| Complete request | `callbackParams`, every query parameter the provider appended as a string, and `user` |
| Connection request | `providerSessionId` and `user` |
| Transaction request | the connection request plus `providerAccountId`, `dateFrom` and `dateTo`. `dateFrom` is the day of the last successful sync, or the history floor on a first sync |
| Holdings request | the connection request plus `providerAccountId` |
| Provider user session | `providerUserId` and `accessToken`. The core persists it, and it stays opaque to the core |

### The shapes you hand back

| Shape | Fields |
| --- | --- |
| Institution | `id`, `name`, `country`, and the optional `logoUrl`, `bic` and `group` |
| Transaction | 24 fields. Six are required: `providerTransactionId`, `bookingDate`, `amountMinor`, `currency`, `remittanceLines` and `status`. The rest carry the counterparty, the IBANs, the ISO 20022 codes, the reference numbers and the note of the reader |
| Account | `providerAccountId`, `type`, and the optional `name`, `iban`, `currency`, `balanceMinor` and `balanceAt` |
| Holding | `providerHoldingId`, `label`, `quantity`, `valuationMinor`, `currency`, and the optional `code`, `codeType`, `unitCost`, `unitValue`, `unrealisedGainMinor` and `valuedAt` |
| Completed connection | `providerSessionId`, `institutionName`, the optional `institutionGroup`, and one `accounts` entry per account with `providerAccountId` and the optional `iban`, `identificationHash` and `name` |

`type` on an account is `ProviderAccountType`, an eleven-member string union that mirrors the member names of the Prisma enum `BankAccountType`. Sync writes the value with no mapping. [Data model](./data-model.md#bankaccounttype) lists all eleven values and marks the six that hold holdings.

## What an optional member costs

| Omitted member | What the product loses |
| --- | --- |
| `createUser` and `deleteUser` | Nothing. `user` arrives as `null` on every request, and the core writes no provider user row. Omit both when the provider needs no per-user identity |
| `fetchAccounts` | **The accounts stay untyped.** The set freezes at link time, `bank_account.type` keeps the default `UNKNOWN`, and `currency`, `balanceMinor` and `balanceAt` stay null. An account the reader activates at the bank after the link never appears |
| `fetchHoldings` | No holding row ever exists for that provider |

The two losses compound. `syncConnection` calls `fetchHoldings` only when the account type is an investment type. With no `fetchAccounts` every type reads `UNKNOWN`, so `fetchHoldings` never runs even on an adapter that has it.

Enable Banking is the worked partial adapter. It declares `isConfigured`, `listInstitutions`, `startConnection`, `completeConnection`, `closeConnection` and `fetchTransactions`, and it omits the four optional members. So it imports transactions and nothing else. [Bank providers](../../apps/fumadocs/content/docs/next/reference/bank-providers.mdx) is the operator view of that difference.

> [!NOTE] No screen shows investment holdings. Sync writes the rows and no procedure selects them. The same holds for the account balance columns. An adapter that implements `fetchHoldings` fills correct rows with no read path, so implement `fetchTransactions` first.

## Register an adapter

### 1. Implement the interface

Create `packages/api/src/providers/<id>/index.ts` and export one object that satisfies `BankingProvider`. Keep the HTTP layer in a sibling `client.ts`, and keep each mapper in its own file. Both shipped adapters follow that split:

```text
packages/api/src/providers/
  powens/
    index.ts
    client.ts
    map-account.ts
    map-connection.ts
    map-holding.ts
    map-transaction.ts
  enable-banking/
    index.ts
    client.ts
    map-connection.ts
    map-transaction.ts
  registry.ts
  types.ts
```

An adapter reads `env` from `@freenary/env/server` and nothing else from the core.

### 2. Add the registry entry

Add one line to the map in `packages/api/src/providers/registry.ts`:

```ts
const providers: Record<string, BankingProvider> = {
  [enableBankingProvider.id]: enableBankingProvider,
  [myBankProvider.id]: myBankProvider,
  [powensProvider.id]: powensProvider,
  ...developmentOnlyProviders,
};
```

`developmentOnlyProviders` holds `mock`, and is empty when `NODE_ENV` is `production`.

No router, no sync code and no web route changes.

### 3. Add the environment variables

Two edits in `packages/env/src/schema.ts`. Add each credential as a Zod schema, with a `.describe()` sentence and a `.meta()` block. Use `optional()` unless the adapter is mandatory. Then add your `id` to the `BANKING_PROVIDER` enum:

```ts
BANKING_PROVIDER: z
  .enum(["powens", "enable-banking", "my-bank"])
  .default("powens")
  .describe(
    "Picks the provider a new bank connection uses: `powens`, `enable-banking` or `my-bank`."
  )
  .meta({
    example: "powens",
    onError: "Any other value stops the start.",
    section: "bank",
  }),
```

The `.meta()` block needs a `section`, an `example` and an `onError` note. `bun run env:check` refuses a key that misses one of the three.

### 4. Register the callback URL at the provider

**No new web route.** `apps/web/src/app/routes/callback/$provider.tsx` is one dynamic route that serves every provider. It renders with `ssr: false`, because the exchange needs the session cookie. No route on the API server answers under `/callback`.

Register the join of `CORS_ORIGIN` and your `callbackPath` at the provider as an allowed redirect URL. For the path `/callback/my-bank` and the origin `https://money.example.com`, that is `https://money.example.com/callback/my-bank`.

### 5. Generate the operator reference

```bash
bun run env:sync
```

The generator writes `.env.example` and the tables of the [Configuration](../../apps/fumadocs/content/docs/next/reference/configuration.mdx) reference from the schema. No compose file needs an edit. The development `server` service reads the optional root `.env` through `env_file`, and the production one does the same.

### 6. Write the mapper tests

Copy the pattern from the mapper tests in the repository. The next section holds the method.

## The connect flow your adapter must satisfy

The **Adapter** column marks the hops your code answers.

| # | Hop | What happens | Adapter |
| --- | --- | --- | --- |
| 1 | The reader opens the bank list | Onboarding or the settings section. Availability gates both surfaces | `isConfigured` |
| 2 | The reader picks a bank | The web app calls `bankConnection.startConnection` | — |
| 3 | The API validates | It re-lists the institutions for that country and demands an exact match. A miss is `BAD_REQUEST "Unknown bank institution"` | `listInstitutions` |
| 4 | The API resolves the identity | `ensureProviderUser` inserts a row when the adapter has `createUser`. Without it, `user` is `null` | `createUser` |
| 5 | The API builds the redirect and the state | The redirect URL joins `CORS_ORIGIN` and `callbackPath`, then the state is encoded and signed | `callbackPath` |
| 6 | The API asks the provider | The adapter returns the URL the browser must open | `startConnection` |
| 7 | The browser leaves | Freenary records no connection yet | — |
| 8 | The provider redirects back | The dynamic web route serves the callback | — |
| 9 | The callback triages | No session sends the reader to the sign-in screen. An `error` parameter means a refusal. No `state` means an incomplete answer | — |
| 10 | The API exchanges | It checks the provider id, checks the HMAC against this session, re-lists the institutions, and demands a stored provider user when the adapter has `createUser` | `listInstitutions` |
| 11 | The provider completes | The adapter reads the callback parameters and finishes the consent | `completeConnection` |
| 12 | The API stores the result | One Prisma transaction: the connection row, then a `createMany` of the account rows | — |
| 13 | Sync starts later | **The callback triggers no sync.** No scheduler, no cron and no webhook receiver exists. Sync runs from the budget page | — |
| 14 | The sync body | Per connection: refresh the accounts, then per account fetch and upsert the transactions, then fetch the holdings of an investment account, then set `lastSyncedAt` if every account imported | `fetchAccounts`, `fetchTransactions`, `fetchHoldings` |
| 15 | The passes after sync | The internal-transfer pass, then the categorisation pass | — |

The sync window is 90 days. `dateFrom` is `lastSyncedAt`, or 90 days back on a first or forced sync, and `dateTo` is today. Both arrive as `YYYY-MM-DD`.

### The signed state parameter

`packages/api/src/lib/bank-connection-state.ts` builds the `state` value that round-trips through the provider. Your adapter passes it through untouched.

The payload is a JSON object with the keys `institution` (its `country`, `id` and `name`), `original`, `providerId` and `returnTo`. The return target is `onboarding` or `settings`. The HMAC is SHA-256 over the user id joined to the serialised payload, keyed by `BETTER_AUTH_SECRET`. It binds three things: the payload, the secret, and the session that started the flow. Verification strips the HMAC, recomputes it over the re-serialised payload, checks the length, then compares with `timingSafeEqual`.

> [!WARNING] The HMAC covers a **re-serialised** object, so verification depends on a parsed key order equal to the encode order. A new state field inherits that constraint. Add it in alphabetical position, and add it to the Zod schema in the same place.

## Data mapping rules

| Rule | Detail |
| --- | --- |
| Money is minor units | `amountMinor`, `balanceMinor`, `valuationMinor` and `unrealisedGainMinor` are integers in the minor unit of their own `currency`. Negative is outgoing. Never send a float amount |
| Currency is a per-row code | Every money field pairs with an ISO 4217 code on the same object. Freenary holds no base currency and converts nothing |
| Quantities are decimal strings | `quantity`, `unitCost` and `unitValue` travel as strings, because units can be fractional and must not pass through a float |
| Holdings are a snapshot | `syncHoldings` deletes the holdings the provider no longer reports, then upserts the rest. A sold position disappears |
| Transactions deduplicate on the provider id | The unique key is the pair of account and `providerTransactionId`. That id must be stable across syncs and never random |
| A booking date is always set | When an Enable Banking transaction carries no `booking_date`, the adapter takes `transaction_date`, then `value_date`, then `dateTo`, never `dateFrom` |
| An unknown kind is `UNKNOWN` | Map an unrecognised account kind to `UNKNOWN` rather than guess |

> [!WARNING] PostgreSQL treats `NULL` as distinct inside a unique index. An empty `providerTransactionId` therefore defeats deduplication, so the same movement inserts again on every sync.
>
> With no stable id from the provider, derive one. Enable Banking hashes the stable fields and appends a repeat index. Two rows with the same fingerprint in one batch therefore stay distinct: `derived:<sha256 prefix>:<occurrence>`.

## Errors

**Throw a plain `Error` with a message an operator can read.** No adapter throws an oRPC error. The routers own the translation to an error code, and the sync path owns the collection into a list.

| Where the throw lands | What happens to it |
| --- | --- |
| Inside a sync, per account | The message joins the error list as `Account <providerAccountId>: <message>`. The other accounts still sync, but `lastSyncedAt` does not advance, so the next window starts where this one did |
| Inside a sync, at connection level | The message joins as `Connection <institutionName>: <message>`. No account of that connection syncs, and `lastSyncedAt` does not advance |
| In the connect flow | The router maps the failure to an oRPC error, and the callback route toasts one failure message |

`syncAccounts` logs the collected messages on the server and returns one `{ kind: "connection-sync", connectionId, institutionName }` entry per failed connection in `failures`. The messages never reach the response; the web toasts a catalog message that names the bank. They do reach the server log, so keep them short and free of secrets.

Two rules the Powens and Enable Banking adapters follow:

- `listInstitutions` does not throw, and it does not hide a failed call behind an empty list. It fails the `Effect` with `BankInstitutionsUnavailable`, which carries the `country`. An empty list therefore means the provider has no bank for that country.
- `closeConnection` and `deleteUser` treat a 404 as success, because the record is already gone.

A sync failure changes no connection status. [Data model](./data-model.md#bankconnectionstatus) owns the status vocabulary and states which of its values the code writes.

## Test an adapter with no live credentials

A sandbox account is not a prerequisite. To exercise the connect flow, the sync and the screens with no adapter of your own, run the `mock` adapter: `bun run dev:up` picks it when `.env` names no provider. To test your own adapter, split the work in two.

### 1. Test the mappers directly

Each mapper is a pure function from a provider payload to one shape. Test it with a captured payload and no network. Six test files already do it, and they are the pattern to copy:

| File | Covers |
| --- | --- |
| `providers/powens/map-account.test.ts` | Both payload shapes, four mapped kinds, the `UNKNOWN` fallback, the precision-based balance, the UTC balance date, the name fallback |
| `providers/powens/map-connection.test.ts` | The completed connection, and the drop of a deleted account |
| `providers/powens/map-holding.test.ts` | The decimal strings, the code-type filter, the minor-unit conversion, and the drop of a deleted or unvalued line |
| `providers/powens/map-transaction.test.ts` | The sign, the status, the remittance lines and the ISO 20022 family code table |
| `providers/enable-banking/map-connection.test.ts` | The whole completed connection, with the account IBAN read from the account id |
| `providers/enable-banking/map-transaction.test.ts` | The top-level creditor agent, and the identity rules of a derived transaction id |

Assert the mapped object, never the internals.

### 2. Stub the HTTP layer, then run the real sync

For anything above a mapper, replace `globalThis.fetch` with a stub that answers your recorded payloads. Then run the real sync against a throwaway PostgreSQL database and read the rows. That gives you three things a mapper test cannot:

1. **Request construction.** Assert the URL, the method, the headers and the body your adapter builds. A wrong authorisation header shows up here.
2. **Persistence.** Assert the account, transaction and holding rows the sync wrote, plus the merchant key the upsert derived.
3. **Idempotence.** Run the sync twice against the same stub. The row counts must not change. This test catches an unstable transaction id.

```bash
docker compose up -d --wait postgres
(cd packages/db && bun run db:migrate:deploy)
bun test packages/api/src/providers
```

The migration reads `DATABASE_URL` from `apps/server/.env`; [Local development stack](./local-stack.md) shows how to write it, and covers both database paths. CI runs the `packages/api` tests but starts no database, so run a test that needs one by hand.

### What a stub cannot prove

A stub proves your adapter reads a payload correctly. It cannot prove the payload matches what the bank sends. Consent expiry, strong customer authentication and rate limits need live credentials. So does a pagination cursor that changes shape, and a per-bank field gap. Record real payloads once, then keep them as fixtures.

`bank_provider_user.accessToken` holds the permanent bearer token sealed with `BETTER_AUTH_SECRET` (`packages/api/src/lib/bank-provider-user.ts`). The AAD names the provider and the user, so a sealed token copied to another row does not open. A sealed value starts with `sealed:`; any other value is a plain token from an older version, sealed at boot by `sealLegacyProviderTokens` or on its first read. Both writes compare the old value, so they never overwrite a newer token. After a secret rotation, `ensureProviderUser` replaces the unreadable row with the new Powens user. The connections made under the old Powens user keep failing until they are disconnected, and that user is left at Powens.

## Related

- [Data model](./data-model.md#bank-connections-accounts-and-transactions) — The tables an adapter fills, with every column and constraint.
- [Bank providers](../../apps/fumadocs/content/docs/next/reference/bank-providers.mdx) — The operator view: credentials, redirect URLs and per-provider capability.
- [Transaction categorisation](./categorisation.md) — What the pipeline does with the fields an adapter maps.
