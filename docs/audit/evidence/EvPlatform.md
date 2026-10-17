I've finished the audit of this area. Every fact below comes from code or the installed dependency. I edited nothing. `bun scripts/env-sync.ts --check` passes: "48 declared variables, both artifacts current".

## Things that need a decision or a fix

1. **`VITE_SERVER_URL` can't be relative.** `apps/web/src/shared/config/server-url.ts` has a code path for a relative value like `/api`. The schema in `schema-web.ts` uses `z.url()`, which rejects a relative value, so that path likely never runs. Either the schema or the code is wrong.
2. **Assistant totals are always labelled `currency: "EUR"`.** `packages/api/src/assistant/tools.ts` hard-codes it in `search_transactions`, even for accounts in another currency.
3. **Powens ignores the end of the sync window.** It filters on `last_update=<dateFrom> 00:00:00` and never uses `dateTo`. Enable Banking sends both `date_from` and `date_to`. If a docs page says "transactions between X and Y" for both providers, it is wrong for Powens.
4. **The categorisation preamble in `.env.example` says no amount is sent.** That's true for the exact amount, but a coarse `amountBucket` is sent (see Classifier). The counterparty name, which can be a person's name, is sent too.
5. **The assistant and the classifier read `env` directly.** The setup screen can't configure them, and only the environment does. Any page that implies the setup screen covers them is wrong.

## Generated configuration tables

- `scripts/env-sync.ts` writes two files: the root `.env.example` and the tables in `reference/configuration.mdx`.
- Each table sits between `{/* env-sync:start <id> */}` and `{/* env-sync:end */}`. The 14 ids, in page order: `count`, `core`, `origins`, `database`, `email`, `sign-in`, `bank`, `assistant`, `categorisation`, `raw`, `client`, `compose`, `compose-dev`, `inert`.
- **Schema tables** have four columns: Variable | Default | What it does | Absent or wrong.
  - Default comes from `meta.default`, else the Zod default, else "unset".
  - A variable marked `productionRequired` reads "`<value>` outside production, required in production".
- **Other tables:**
  - `raw`: Variable | Read by | What it does.
  - `client`: Variable | Default | What it does.
  - `compose`: four columns.
  - `compose-dev`: three columns.
  - `inert`: Variable | Why it does nothing.
- **Variables the generator declares itself** (the `EXTERNAL` list):
  - compose: `POSTGRES_PASSWORD`, `FREENARY_VERSION`, `FREENARY_URL`, `SERVER_PORT`, `WEB_PORT`, `POSTGRES_PORT`.
  - compose-dev: `FREENARY_SLUG`, `SERVER_HOST`, `WEB_HOST`, `DOCS_HOST`, `MAIL_HOST`, `DOCS_PORT`.
  - raw: `DEV_PUBLIC_URL`, `PUBLIC_SERVER_URL`, `SERVER_URL`, `SKIP_ENV_VALIDATION`, `GITHUB_REPOSITORY`, `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
  - inert: `POSTGRES_DB`, `POSTGRES_USER`.
- **Placement in `.env.example`** (`envFile`):
  - Only `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` are written uncommented.
  - `NODE_ENV` and `PORT` are left out.
  - Everything else is written as a commented example.
  - The file ends with "Images and host ports" and "Development only" blocks.
- **What the generator refuses:**
  - A schema key with no `.describe()`, `onError` or `example`.
  - A `process.env` or `Bun.env` read, or a compose `${VAR}`, that nothing declares. Names starting with `VERCEL_` are allowed.
  - An `EXTERNAL` entry that no file uses, unless it is inert.
- **Validation** (`packages/env/src/server.ts`):
  - `emptyStringAsUndefined: true`, so an empty value counts as unset.
  - Any non-empty `SKIP_ENV_VALIDATION` turns validation off.
  - `devDefault` gives `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN` and `DATABASE_URL` defaults only outside production.

## Setup screen vs environment (`packages/instance-config`)

- **Which keys the setup screen can set:** 14 (`instanceConfigurableKeys`).
  - Bank: `BANKING_PROVIDER`, `POWENS_DOMAIN`, `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`, `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY`.
  - Email: `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`.
- **Precedence is per key.** A non-empty `process.env[key]` always wins (`environmentOwns`). Otherwise the stored value is laid over the environment and the whole result is validated again.
- **If the combined values fail validation:** the error is kept as `instanceConfigFault` (shown by `instance.describe`), and the instance runs on the environment alone.
- **If the stored settings can't be read at boot:**
  - Production: it throws, so the server doesn't start.
  - Otherwise: it warns "… The environment alone is in force."
- **If one stored row won't decrypt:** it logs "The stored value of X does not open with the current BETTER_AUTH_SECRET." and skips that row.
- **Settings are read once, at boot.**
  - `save` returns `restartRequired: true`, but doesn't restart.
  - `complete` exits the process 250 ms later (exit code 0), and only if a change is still unapplied. The restart then depends on `restart: unless-stopped`.
- **Refusals from `save`:**
  - `environment-owned`: the environment picks a different provider.
  - `missing-fields`.
  - `invalid`.
  - `nothing-to-save`: the environment already owns every field.
- **What the screen shows:**
  - Secret values: never.
  - Text and URL values that come from the environment: masked to the first 4 and last 4 characters with "…" between. A value of 8 characters or fewer shows only "…".
- **Credential check (probe):** times out after 10 s. It reports `unreachable`, `rejected` or `invalid`.
- **Operator role:**
  - Granted by the session-create hook through `claimForFirstSession`. The first session wins, using the single `instance_setup` row (id `singleton`) as a lock.
  - Nothing grants the role later.
  - It covers only `instance.check`, `instance.complete`, `instance.describe` and `instance.save`. `instance.status` is public.

## Sealing (`seal.ts`)

- Algorithm: AES-256-GCM.
- Key: HKDF-SHA256 from `BETTER_AUTH_SECRET`, with salt and info both `freenary/instance-setting/v1`, 32 bytes.
- 12-byte random IV. The row key is bound as additional authenticated data, so a value copied to another row won't open.
- Stored format: `iv.tag.body`, each part base64url.
- Table `instance_setting` holds `key`, `sealed`, `updatedAt` and `updatedBy` (the operator's id).
- A new `BETTER_AUTH_SECRET` makes every sealed row unreadable. The same secret also:
  - signs sessions;
  - encrypts the two-factor secret and backup codes (better-auth);
  - is the HMAC key for the bank connection state.

## Bank providers

**Common to both**

- The default provider is `powens`. Only new connections use `BANKING_PROVIDER`.
- Each connection stores its own `provider`, and syncs and disconnects use that one.
- Callback URL: `${CORS_ORIGIN}${callbackPath}`, which is `/callback/powens` or `/callback/enable-banking`. It is the web origin, not the API origin.
- **Connection state:**
  - Plain JSON: `institution {country, id, name}`, `original`, `providerId`, `returnTo` (`onboarding` or `settings`), plus `hmac`.
  - `hmac` is HMAC-SHA256 of `userId:payload` with `BETTER_AUTH_SECRET`, compared in constant time.
  - It is signed, not encrypted.
- **Sync:**
  - No scheduler and no timers. A sync only starts when a user calls `budget.syncAccounts` or `budget.recategorise`.
  - Window: `PROVIDER_SERVED_HISTORY_DAYS = 90`. It starts at `lastSyncedAt`, or 90 days back on the first sync or when `force` is set.
  - Connections run one at a time, accounts one at a time, and transactions are upserted one by one.
  - Only connections with status `ACTIVE` are synced. A failure is recorded as an error string and doesn't change the status.

**Powens**

- Needs all three of domain, client id and client secret. Host: `<domain>.biapi.pro/2.0`; a `.biapi.pro` suffix is stripped.
- `/auth/init` creates a per-user token. It is stored as plain text in `bank_provider_user.accessToken`, with a unique (user, provider) pair.
- Webview: `https://webview.powens.com/connect` with a `singleAccess` code.
- **States that block a sync:** `SCARequired`, `actionNeeded`, `additionalInformationNeeded`, `decoupled`, `passwordExpired`, `webauthRequired` and `wrongpass`. The error reads "Powens connection needs the user's attention (state)".
- **Bank list:** a bank is listed only if it isn't `hidden` or `restricted` and offers the `bank` or `wealth` product.
- **Data:** investment holdings are fetched for investment accounts. Pages hold 1000 transactions. Currency falls back to EUR, and precision falls back to 2 decimals.
- **When the last connection is removed:** `DELETE /users/me` is called, and its failure is ignored. The token row is then deleted.

**Enable Banking**

- Needs both the app id and the private key.
- Every request carries a new RS256 JWT: `kid` and `sub` are the app id, `iss` is `enablebanking.com`, `aud` is `api.enablebanking.com`, and it lasts 3600 s.
- A literal `\n` in the key becomes a real newline.
- API host: `https://api.enablebanking.com`.
- Consent: `valid_until` is now + 90 days, with `psu_type` `personal`. Nothing tracks a shorter grant from the bank.
- The first page requests `strategy=longest`. Later pages follow `continuation_key`.
- No per-user token and no holdings.

**Switching provider**

- Existing connections keep the old provider.
- If the old provider's credentials are removed:
  - Their sync fails with "Powens is not configured" or "Enable Banking is not configured".
  - `disconnect` skips the revocation (`revocationRequested: false`) and still deletes the row.
- Only `getProviderAvailability` and the bank list follow the new default.

## Merchant dictionary

- File: `packages/api/data/merchants.jsonl.gz`.
- Built into the image by `build:data`. That script downloads the newest `data-*` release of `GITHUB_REPOSITORY` and falls back to `build:data:generate`.
- Loaded lazily and limited to the countries in use. The file is missing → it warns `Dictionary file not found` and skips.
- With `DICTIONARY_PUBLIC_KEY` set, it needs `merchants.jsonl.gz.sig` and checks it with Ed25519 `crypto.verify`. Otherwise it refuses with "Dictionary signature missing:" or "Dictionary signature invalid:".
- Key generation: `cd packages/api && bun run generate:key`.

## Classifier

- Reads `env` only. Requests time out after 10 s. `Authorization: Bearer` is sent only when a key is set.
- **Slots:**
  - A slot needs both its URL and its model, or startup fails.
  - A fallback without a primary fails.
  - The same protocol and model in both slots fails.
  - The cache key is a SHA-256 of provider, model, taxonomy version, merchant key or descriptor, country, direction and MCC.
- **What leaves the instance (`ClassificationInput`):**
  - `amountBucket`: `micro` under 1000 minor units, `small` under 5000, `medium` under 20000, otherwise `large`.
  - `channel`, `counterpartyName`, `country`, `currency`, `direction`, `merchantCategoryCode`, `merchantKey` (blank on the IBAN path), `normalisedDescriptor`, `path`.
  - No exact amount, no date, no IBAN, no account.
- **How each protocol sends it:**
  - `system-one`: `{model, questions, state: input}`, posted to the URL as given.
  - `llm`: the whole input as JSON in the user message, posted to `/chat/completions` with `logprobs: true`.
  - `zero-shot`: `{inputs, parameters}`. `inputs` joins descriptor, counterparty, MCC, channel, bucket, currency and country.

## Assistant

- Uses `createOpenAICompatible` with `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY`, from `env` only. Missing either the base URL or the model → `503 unconfigured`.
- **Limits:**
  - Rate: 30 questions per 300 s per user (`ai-chat:<userId>`). Over the limit → `429 rate_limited`.
  - Questions are capped at 8000 characters and 6 steps.
- **Sent to the model:**
  - A system prompt with the locale, today's date and the date range of the data.
  - Tool results:
    - Accounts: id, bank name and account name, no IBAN.
    - `search_transactions`: up to 20 rows (10 by default), each with amount, date, description, counterparty, category and id.
  - The other tools send aggregates.

## Reverse proxy

- **Forwarded paths** (`FORWARDED_PATH_PREFIXES`): `/api/auth`, `/rpc`, `/ai/chat`, `/api-reference`. A path matches on the exact prefix or the prefix followed by `/`.
- Forwarding happens only when `SERVER_URL` is set.
- **Headers:**
  - Dropped: `connection`, `host`, `keep-alive`, `proxy-connection`, `te`, `trailer`, `transfer-encoding`, `upgrade`.
  - `accept-encoding` is forced to `identity`.
  - `content-encoding` and `content-length` are stripped from the response.
  - Redirects are passed back as they are (`redirect: manual`).
- **Timeout:** 9 s, then `502 Bad Gateway`. A caller that leaves gets a 499.
- `X-Forwarded-For` passes through unchanged, and rate limits read it through `TRUSTED_PROXIES`.
- **Cookies** (`resolveCookiePolicy`):
  - Always `httpOnly`.
  - `Secure` when `BETTER_AUTH_URL` uses https.
  - `SameSite=Lax` when `AUTH_COOKIE_DOMAIN` is set or both hostnames are the same, otherwise `None`.
  - Two hostnames over plain HTTP with no domain throws in production and warns otherwise.
  - Bad `AUTH_COOKIE_DOMAIN` values (trailing dot, single label, not a parent of both hostnames) throw.
- **Cookie names:** better-auth 1.7.1 adds `__Secure-` over https. The names are `better-auth.session_token` (7 days), `session_data` and `dont_remember`.

## Security surface

- **Ports:**
  - `docker-compose.yml` publishes `server` on `${SERVER_PORT:-3000}` and `web` on `${WEB_PORT:-3001}`, on every interface.
  - Postgres is published on `127.0.0.1` only.
  - `deploy/docker-compose.yml` publishes no host ports (`expose` only).
- **Sessions:** last 7 days, and `freshAge` equals the session lifetime.
- **Re-authentication within 900 s** for: `/link-social`, passkey add and delete, `/unlink-account`.
- **Two-factor:**
  - Trusted devices last 30 days.
  - Lockout uses the library defaults (not set here): 10 failures lock it for 900 s, stored in `two_factor.failedVerificationCount` and `lockedUntil`.
- **Breach check:** enabled by default. It sends the first 5 SHA-1 hex characters to `api.pwnedpasswords.com/range/` with `Add-Padding`, on sign-up, change password and reset password. It fails closed: if the service can't be reached → 500 "Failed to check password…".
- **Passwords:** 12 to 128 characters.
- **One-time codes:** 6 digits, valid 600 s, 3 attempts, stored hashed. `/sign-in/email-otp` and the `sign-in` code type are turned off.
- **Rate limits:** stored in the database, 100 per 60 s by default. Per-path rules are in `policy.ts`. They're off when `NODE_ENV=test`.
- **CORS:** only `CORS_ORIGIN`, with credentials, methods GET, POST and OPTIONS.

## Scaling

- **One sync per user:**
  - `claimSyncRun` claims the `sync_run` row (keyed by userId) when it is `FINISHED` or silent for more than 5 minutes (`SYNC_RUN_ABANDONED_AFTER_MS`), or creates it with `skipDuplicates`.
  - The claim is keyed by `startedAt`, so writes from a stale run do nothing.
  - Progress is written at most once a second.
- **Database connections:** two Prisma clients per API process (`@freenary/db` and the one `createAuth` makes). Each uses `PrismaPg` with no pool size set, so the `pg` default applies.
- **Volumes:** only `freenary_postgres_data`. The dictionary lives in the image.
- **Logs:** the file log is written outside production only.

## Building images

- **Server image:**
  - Builder: `oven/bun:1`, with `SKIP_ENV_VALIDATION=1` and a placeholder `DATABASE_URL` set only in the builder stage.
  - Build argument: `GITHUB_REPOSITORY` (default `suiramdev/freenary`).
  - BuildKit secret `GITHUB_TOKEN`, which doesn't end up in the image.
  - Runs `bun dist/index.mjs` and exposes port 3000.
- **Web image:**
  - Build argument `FREENARY_VERSION` becomes `VITE_FREENARY_VERSION`.
  - Runner sets `HOST=0.0.0.0` and `PORT=3001`, and runs `.output/server/index.mjs`.
- **`.dockerignore`** (the only one, at the root) excludes:
  - `node_modules`, `.git`, build outputs and logs;
  - every Dockerfile and `docker-compose*.yml`;
  - every `.env` and `.env.*` except `.env.example`.
- **Platforms:** CI (`images.yml`) builds `linux/amd64` on `ubuntu-latest` and `linux/arm64` on `ubuntu-24.04-arm`, pushes by digest, and passes `GITHUB_REPOSITORY`, `FREENARY_VERSION` and the `GITHUB_TOKEN` secret.

## Docs I spot-checked

These match the code: `scaling.mdx` (two pools, `sync_run`, restart behaviour), `security.mdx` (10 failures / 15 min lockout, fail-closed breach check, AES-GCM sealing), `reverse-proxy.mdx` (9 s limit, `/api/auth/ok` returning `{"ok":true}`), and `bank-providers.mdx` (90-day consent and window). Point 3 above may still affect `bank-providers.mdx`.
