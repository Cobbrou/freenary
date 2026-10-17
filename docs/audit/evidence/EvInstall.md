I've traced every item in the assignment through the code and checked both compose files with `docker compose config`. I edited no files. Below are the facts, with seven discrepancies at the end that the docs should account for.

## Product features

`apps/web/src/app/shell/nav-items.ts` lists six areas:

| Item | Status | What is there |
| --- | --- | --- |
| **Home** (`/`) | Shipped | The assistant chat (`pages/home/ui/assistant-*`). It needs `AI_BASE_URL` and `AI_MODEL`; with either unset, the route answers `503 unconfigured`. |
| **Portfolio** | Planned | Sidebar shows a **Planned** badge and dims the item; the page is a 10-line stub. |
| **Budget** | Shipped | Sub-pages **Transactions** and **Recurring**, with KPI strips, many charts and filters. |
| **Analysis** | Planned | **Planned** badge. |
| **Goals** | Planned | **Planned** badge. |
| **Settings** | Shipped | Four groups: **Appearance**, **Budget**, **Connections**, **Security**. Security covers passkeys, 2FA, sessions and linked accounts. |

Other routes: `/login`, `/setup`, `/onboarding`, `/callback/$provider`, and the dev-only `dev-avatar`.

## Compose files

**Root `docker-compose.yml`**

- Publishes server on `${SERVER_PORT:-3000}`, web on `${WEB_PORT:-3001}`, and Postgres on `127.0.0.1:${POSTGRES_PORT:-5432}` only.
- Requires `env_file: .env`. Defaults: `BETTER_AUTH_URL` = `http://localhost:3000`, `CORS_ORIGIN` = `http://localhost:3001`, `NODE_ENV=production`.
- Web gets `SERVER_URL=http://server:3000`, and `PUBLIC_SERVER_URL` takes `BETTER_AUTH_URL`.

**`deploy/docker-compose.yml`**

- Publishes no host port; web is reachable only on port 3001 (`expose`) inside the Docker network.
- `.env` is optional (`required: false`).
- Takes one public origin, `FREENARY_URL`, and uses it for `BETTER_AUTH_URL`, `CORS_ORIGIN` and `PUBLIC_SERVER_URL`.

**`deploy/coolify.yml`**

- Uses Coolify magic variables: `SERVICE_PASSWORD_POSTGRES`, `SERVICE_HEX_64_AUTHSECRET`, and `SERVICE_URL_WEB` (from `SERVICE_URL_WEB_3001`).
- `migrate` has `exclude_from_hc: true`.

**`deploy/dokploy/template.toml`**

- Generates `FREENARY_URL=http://${domain}`, `FREENARY_VERSION=latest`, a 32-character Postgres password and a 64-character auth secret.
- Maps the domain to the `web` service on port 3001.

**`scripts/dokploy-import.ts`** (`bun run deploy:dokploy`) prints base64 of the JSON `{compose, config}` built from `deploy/docker-compose.yml` and `template.toml`.

**Root scripts:** `docker:up` / `docker:down` / `docker:logs`, `db:start` / `db:watch` / `db:stop` / `db:down` (postgres via the root compose), `dev:up` / `dev:mail` / `dev:down` / `dev:logs` / `dev:reset`, and `deploy:dokploy`.

## Required-variable messages

Confirmed with `docker compose config`:

- **Root file:** `Set POSTGRES_PASSWORD in .env` and `Set BETTER_AUTH_SECRET in .env`. With both set, the check passes.
- **Deploy file:**
  - `Set POSTGRES_PASSWORD`
  - `Set BETTER_AUTH_SECRET to 32 characters or more`
  - `Set FREENARY_URL to the public URL of the web app, such as https://freenary.example.com`
  - With all three set, the check passes.

Compose prints each message once per place the variable is used, so the same line repeats.

## Images and tags (`images.yml`)

- **Triggers:** a push to `dev` or `main`, plus a manual run that takes a `ref`.
- **Builds:** `server` and `web` for `linux/amd64` (on `ubuntu-latest`) and `linux/arm64` (on `ubuntu-24.04-arm`), merged into one multi-arch manifest.
- **Tags:**
  - A stable `vX.Y.Z` ref gets `X.Y.Z`, `X.Y`, `X` and `latest`.
  - A pre-release (version contains `-`) gets only its exact version.
  - A branch gets `<branch>` and `sha-<7 characters>`.
- The `FREENARY_VERSION` build argument carries the version.

## First start order

1. `postgres` becomes healthy (`pg_isready`, every 10s, 5 retries).
2. `migrate` runs `bun x prisma migrate deploy` and must exit successfully. It re-runs on every `up`.
3. `server` starts once `postgres` is healthy and `migrate` has completed. Its healthcheck fetches `:3000/` (start period 10s).
4. `web` starts once `server` is healthy; its healthcheck fetches `:3001/`.

## Sign-up and operator claim

- Sign-in is one screen: **Welcome to Freenary**, "Enter your email to sign in or create an account". The form then shows either sign-in or sign-up depending on whether the address has an account.
- Sign-up submits with **Create account**. Passwords are 12–128 characters.
- Email verification is required only when an email provider is configured. In that case the user enters a 6-digit code (valid 600s), and verifying signs them in.
- **Operator claim** happens in a better-auth hook that runs after a session is created (`packages/auth/src/index.ts`), not at sign-up. `claimForFirstSession` sets `instanceSetup.claimedAt` once on the `singleton` row and gives that user `role: OPERATOR`. So the first account to get a session becomes operator, whatever sign-in method it used. A claim failure is only logged as a warning.

## `/setup` flow

**Who sees it.** `/setup` sends guests to `/login`. Until setup is complete, `/login`, every signed-in page and `/onboarding` redirect **every** member to `/setup`, not only the operator. A non-operator sees **Only the operator can set up this instance** and no stepper.

**Steps.** The stepper reads **Bank**, **Email**, **Done**.

**Bank step** — titled **Bank provider**, "Pick the service that connects bank accounts."

- Options: **Powens**, **Enable Banking**, and **Skip for now**, which is always last.
- Powens fields: **Powens domain**, **Client ID**, **Client secret**. Enable Banking fields: **Application ID**, **Private key (PEM)**.

**Email step** — titled **Email delivery**.

- Options: **Resend**, **SMTP**, **Skip for now**.
- Resend fields: **Sender address**, **API key**.
- SMTP fields: **Sender address** and **Host**; under **More options**: **Port**, **Implicit TLS**, **User**, **Password**.

**Moving through a step.**

- **Continue** opens the credentials form, titled **Connect {provider}** with a link "How to get {provider} credentials".
- **Save and continue** tests the connection first and saves only if the test passes.
- If the test fails, **Save anyway** appears. Saving that way shows the toast "Saved without a connection test."
- If a provider is set in the environment, the step instead shows **{provider} is ready** / "Set by your server's environment variables.", with **Test connection** and **Continue** buttons.

**Done step** — titled **Review and finish**.

- Each integration shows **Configured**, **Off** or **Incomplete**.
- **Finish setup** sets `completedAt`. If any saved change has not been applied yet, the server exits after 250ms (`process.exit(0)`) and the page shows **Applying your settings…**. It polls every 2s for up to 60s.
- If the server does not come back, the page shows **The server did not restart** with **Try again** and **View troubleshooting**.
- On success, the toast is "The instance is set up." and the user lands on `/`.

## Powens sandbox link flow

- **Domain.** `POWENS_DOMAIN` takes a value like `acme-sandbox`; `.biapi.pro` is added if missing. `BANKING_PROVIDER` defaults to `powens`.
- **Setup check.** It calls `POST /auth/init` to create a throwaway user, then deletes it with `DELETE /users/me`. If the delete fails, it logs a warning to delete the user in the Powens console.
- **Connect.**
  1. The app creates a Powens user per Freenary user (`/auth/init`).
  2. It gets a single-access code from `/auth/token/code?type=singleAccess`.
  3. It redirects to `https://webview.powens.com/connect` with `client_id`, `code`, `connector_uuids`, `domain`, `redirect_uri` and `state`.
- **Redirect URI.** It is `${CORS_ORIGIN}/callback/powens`. The Powens console very likely has to allow this URI, but that comes from Powens, not from this repo — check it before putting it in the docs.
- **Callback.** `/callback/powens` runs only in the browser and needs a session. It shows "Finishing bank connection", then one of:
  - **Bank connected**
  - "Bank connection cancelled. Nothing was linked." (when Powens returns `error`)
  - "The bank sent back an incomplete response." (when `state` is missing)
  - "Bank connection failed. You can try again or skip." (from onboarding) or "…You can try again." (from settings)
- **Unusable connection.** If the connection needs the user's action, the error is `Powens connection needs the user's attention (<state>)`.

## Onboarding

1. **Tax residency** ("What's your tax residency?"): pick countries with the **Add a country…** combobox. Only FR is fully supported; other countries get a **Limited support** badge. The step also shows "Want to add support for your country?" with a **Contribute here** link, then **Continue**.
2. **Bank connection** ("Connect your bank") appears only if the bank provider `isConfigured()`. Otherwise **Continue** finishes onboarding straight away. The step has **Back**, **Skip for now** and **Finish** / **Finish ({count})**.

The chosen countries are kept in `sessionStorage` (`freenary:onboarding`) across the bank redirect. Completing shows "You're all set!" and goes to `/`.

## Discrepancies to flag

1. The root compose requires `.env` (`env_file: .env`), while the deploy compose treats it as optional.
2. The root compose uses two origins (3000 and 3001); the deploy, Coolify and Dokploy setups use one origin through `web`.
3. `coolify.yml` sets no `restart:` policy, but **Finish setup** depends on the container restarting after `process.exit(0)`. Whether Coolify adds a restart policy itself is unverified.
4. The Dokploy template sets `FREENARY_URL` to `http://`, not `https://`.
5. In onboarding, **Skip for now** and **Finish** call the same handler.
6. The operator is the first account to get a session, not strictly the first sign-up. With email verification on, that means the first account to verify.
7. All members are blocked at `/setup` until the operator finishes it.
