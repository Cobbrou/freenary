I audited the HTTP API against the code and against a live server. The existing `reference/api.mdx` and `reference/procedures.mdx` hold up almost entirely. I found one wrong claim, one dead error code, and a few gaps.

**How I checked it:** I read `apps/server/src/index.ts`, all of `packages/api/src/routers/**`, the `packages/auth` cookie and limit settings, the `/ai/chat` handler, and better-auth 1.7.1's rate-limiter code. Then I ran the server against a throwaway Postgres 17 (all migrations applied), with `NODE_ENV=development`, `BETTER_AUTH_URL=http://localhost:39123` and `CORS_ORIGIN=http://localhost:39124`. A second run added a dummy AI model so `/ai/chat` got past its 503. The container and temp files are removed; I didn't edit any repo file.

## Procedure count: 42

assistant 3, auth 3, bankConnection 6, budget 14, instance 5, onboarding 2, settings 7, plus `healthCheck` and `privateData`. The served `spec.json` lists the same 42 paths, all `post`.

**Access:**

- **Public (5):** `healthCheck`, `auth.accountExists`, `auth.capabilities`, `auth.viewer`, `instance.status`.
- **Operator (4):** `instance.describe`, `instance.check`, `instance.save`, `instance.complete`. An operator procedure is one where the database `role` is `OPERATOR`.
- **Protected:** the other 33.

The docs' table matches this.

## Recorded responses

| Call | Status | Body |
| --- | --- | --- |
| `POST /rpc/healthCheck` `{}` | 200 | `{"json":"OK"}` |
| `POST /api-reference/healthCheck` | 200 | `"OK"` |
| `POST /rpc/auth/viewer` (no cookie) | 200 | `{"json":{"kind":"guest","sessionCookieShared":true}}` |
| `auth.viewer` (signed in) | 200 | `{"json":{"kind":"member","onboarded":false,"sessionCookieShared":true}}` |
| `POST /rpc/budget/getAccounts` (no cookie) | 401 | `{"json":{"defined":false,"code":"UNAUTHORIZED","status":401,"message":"Unauthorized"}}` |
| `instance.describe` as the second account | 403 | `…"code":"FORBIDDEN"…"message":"Forbidden"` |
| `auth.accountExists` `{"email":"nope"}` | 400 | `"message":"Input validation failed","data":{"issues":[{…"path":["email"],"message":"Invalid email address"}]}` |
| `onboarding.completeOnboarding` `["fr"]` | 400 | issue `Expected an ISO 3166-1 alpha-2 country code` |
| `budget.syncAccounts` body `null` | 400 | `Invalid input: expected object, received null` |
| `auth.accountExists` ×22 | 20 × 200, then 429 | `TOO_MANY_REQUESTS` |
| `/ai/chat` with no cookie / signed in with no model / bad body | 401 / 503 / 400 | `unauthorized` / `unconfigured` / `bad_request` |
| `/ai/chat` burst after 1 `saveTurn` + 3 bad requests | 26 × 400, then 429 | The bucket is shared and malformed requests count |

Every documented domain error I reached came back with the exact code and message the docs give: `Unknown category: bogus`, `Category not found`, `Transaction not found`, `Bank connection not found`, `No country to list banks for`, the 503 `Could not load banks for this country`, `Missing bank connection state`, `Unknown banking provider`, `Invalid bank connection state`, `Conversation is not the active one`, `Unknown integration`, and `outcome: missing-fields`.

## Confirmed live

- **Routes and methods:**
  - `/rpc` accepts PUT and DELETE (200); only GET gets 405 `METHOD_NOT_SUPPORTED`.
  - `/api-reference/<proc>` accepts POST only; GET and PUT get 404 with `Not Found`.
  - A PUT under `/api/auth/*` gets 405 with `Method Not Allowed`.
  - An unknown path gets 404 with `NOT_FOUND`.
  - OPTIONS gets 204 on any path.
- **OpenAPI document:** `3.1.1`, title `API Reference`, version `0.0.0`, and `servers[0]` is `http://localhost:39123/api-reference`. It has no `components` and no `security`, every response schema is `{anyOf:[{},{not:{}}]}`, and it omits `/ai/chat`.
- **Session cookie:** `better-auth.session_token`, with `Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`.
  - The `__Secure-` prefix applies when `BETTER_AUTH_URL` starts with `https://` (from the better-auth source, not seen live).
  - `rememberMe:false` drops `Max-Age` and adds a `better-auth.dont_remember` cookie.
- **Bearer token:** `Authorization: Bearer <session token>` alone gets 401.
- **CORS:** a foreign `Origin` gets no `Access-Control-Allow-Origin` header.

## Docs that need a fix

1. **`NOT_IMPLEMENTED` (501) can't happen.** `packages/api/src/instance/probes.ts` has a check for all six integration:variant pairs, and an unknown variant fails earlier with 404. Both pages list it (the `instance.check` errors and the API error table). Live, `instance.check` on `email`/`disabled` returns `{"outcome":"verified"}`, which means `verified` also covers "nothing to check" for a `disabled` variant. That isn't documented.
2. **`budget.getTransactions` `limit` isn't an integer.** The schema is `z.number().min(1).max(100)` with no `.int()`, and the spec shows `limit` without `"type":"integer"`. `limit: 1.5` returned 200 on an empty account. With rows, Prisma would get `take: 2.5`, which should be a 500. I didn't reproduce that because the account had no transactions. Either add `.int()` (a code fix) or document the rule.
3. **`budget.getMerchants` `search` uses ILIKE without escaping.** In `budget.ts`, `%` and `_` act as wildcards. `getTransactions` uses Prisma `contains`, so the two `search` fields behave differently. Neither page says so.
4. **The procedure limiter ignores test mode.** `auth.accountExists` and `saveTurn`/`/ai/chat` count even under `NODE_ENV=test`, while better-auth turns its own limiter off there. Worth a line for anyone writing tests.
5. **When the caller address is unknown,** `consumeRateLimit` puts the caller in one shared `untrusted` bucket, and better-auth uses a single shared `no-trusted-ip` bucket per path. Every unplaced caller then shares one limit. The docs only say the address comes from `X-Forwarded-For`.

## Smaller gaps

- **CORS responses echo the request's header names in `Access-Control-Expose-Headers`** (for example `host,user-agent,accept,origin,…`). This is the `@elysiajs/cors` default; it's harmless and undocumented.
- **`bankConnection.disconnect` on a connection whose stored `provider` isn't registered** gets a 500, because `getProvider` throws with no handler.
- **`exchangeCode` doesn't check the provider is configured** before using it.
- **`privateData` returns the full user record,** including `twoFactorEnabled`, `taxCountries` and `emailVerified`. On `/rpc` its dates also come with an oRPC `meta` array. The page's "raw Better Auth user record" is accurate.
- **`instance.save` with a `disabled` variant answers `saved`, not `nothing-to-save`,** and clears every stored key of that integration (`writesOf` writes `null` for each one). The docs match the code, but this effect is easy to miss.

## Checked against code, no change needed

- **Better-auth rate limits:**
  - The built-in defaults are 3/10 s for `/sign-in*`, `/sign-up*`, `/change-password` and `/change-email`, and 3/60 s for the password-reset and one-time-code paths.
  - The two-factor plugin sets `/two-factor/*` to 3/10 s.
  - Freenary's own rules override those: 10/60 s for email and social sign-in, 5/300 s for sign-up, 10/300 s for TOTP, 5/300 s for backup codes, 20/60 s for the two passkey paths. Everything else is 100/60 s, and counters live in the database.
  - The API page's table matches this, and the "other 40 procedures have no limit" line is right.
- **`/ai/chat` refusal order:** 401, then 503, then 429 (charged before the body is read), then 400. The locale regex is `^[a-z]{2}(?:-[A-Z]{2})?$`, questions are capped at 8000 characters, there are at most 6 steps, and the 7 tools call `budget.*` through an in-process client.
