I ran the local non-Docker path on a scratch worktree and it works, with one catch: `bun install` fails under the Node version on this machine. The contributing docs never mention Node. I also found a few wrong statements in the docs and two failing tests.

## Bugs and mismatches

1. **Node is a hidden requirement.** A clean `bun install` fails under Node 23.11: `Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+` (the `prisma` preinstall exits 1). It worked under Node 26.8. `contribute.mdx` says you only need "Bun `1.3.14` … and Docker". It also mixes up two Bun versions: the scratch run used Bun 1.4.2 and CI uses `bun-version: latest`, while `packageManager` pins `bun@1.3.14`.
2. **Which branch a release is cut from.** `.github/CONTRIBUTING.md:54` says "`dev` is the branch a release is cut from". That's wrong: `release.yml` refuses anything but `main` (the "Refuse anything but main" step). The release paragraph at line 78 is correct.
3. **`DOCS_PORT` does nothing.** `docker-compose.dev.yml:139` sets `DOCS_PORT: ${DOCS_PORT:-4000}`, but nothing reads it. The port comes from `vite dev --port=4000` in `apps/fumadocs/package.json`, and that overrides `port: 3000` in `apps/fumadocs/vite.config.ts`. `scripts/env-sync.ts:268` allow-lists it.
4. **Wrong command in the mail compose comment.** `docker-compose.mail.yml` says "`bun run dev:up --mail` layers this file". The script is `bun run dev:mail`. The comment's form also happens to work, because `dev.ts` filters `--mail` out of any position.
5. **Two tests fail at HEAD (b7baccd).** A full `bun test` gave 646 pass, 2 fail:
   - `deriveMerchantKey > card path > drops deferred and immediate debit markers`
   - `categoriseTransaction > direction invariant > keeps that same merchant on a debit`

## Confirmed by running it

On a scratch worktree at HEAD (`/tmp/freenary-contrib-scratch`, since removed). Postgres ran under a separate project name, `COMPOSE_PROJECT_NAME=freenary-contrib-scratch`, because `docker-compose.yml` uses the fixed name `freenary`; that kept the shared volumes untouched.

```bash
bun install                                   # fails on Node 23, works on Node 26
cp .env.example .env
echo 'DATABASE_URL=postgresql://postgres:password@localhost:5432/freenary' > apps/server/.env
docker compose up -d --wait postgres          # healthy
(cd packages/db && bun run db:migrate:deploy) # "All migrations have been successfully applied."
bun run dev
```

- **Ports:** server on 3000 (`/api/auth/ok` returns `{"ok":true}`), web on 3001 (307), docs on 4000 (200).
- **Sign-up:** `POST /api/auth/sign-up/email` returned 200 with a session cookie and token, so you're signed in straight away with no email provider.
- **Teardown:** containers, volume and network removed, worktree removed and pruned.

I did not run `dev:up` (Traefik). Your own `freenary-dev` stack and `devproxy-freenary-traefik-1` were already running, so I checked that path by reading the code only.

## Facts for the docs

**Root scripts:**

- `dev`, `build`, `check-types`, `docs:check`, `check:fsd` (runs `lint:fsd`) go through turbo.
- `env:sync` / `env:check` run `scripts/env-sync.ts`.
- `dev:up` = `dev.ts up --build --watch`; `dev:mail` = `dev.ts --mail up --build --watch`; also `dev:down`, `dev:logs`, `dev:reset` (`down -v`, then `up --build --watch`).
- `docker:up`/`docker:down`/`docker:logs`, `db:*`, `build:data`, `deploy:dokploy`, `check` (`ultracite check`), `fix`.
- There is no `test` script.

**Workspace scripts:**

- **`check-types`:** only `apps/server` (`tsc -b`) and `packages/ui` have one.
- **`apps/web`:** no type-check script; `dev` runs a Paraglide compile, then `vite dev`.
- **`apps/fumadocs`:** `dev` (port 4000), `build`, `types:check`, `docs:check`, `docs:snapshot`, `lint:fsd`.
- **`packages/db`:** `postinstall` runs `prisma generate`, plus `db:migrate:deploy`.

**turbo.json:**

- `build` depends on `^build` and writes `dist/**`.
- `docs:check` and `lint:fsd` declare their own inputs.
- `dev`, `db:*` and `build:data` are uncached.

**lefthook pre-commit** (runs jobs in parallel):

- `oxlint --fix`, then stage the fixes.
- `oxfmt --write`, then stage the fixes.
- `env:sync`, but only when a file matches `packages/env/src/schema*.ts`, `docker-compose*.yml` or `scripts/env-sync.ts`.

The hook is installed by the `lefthook` package's own postinstall; there is no `prepare` script.

**CI (`ci.yml`):** runs on PRs, on pushes to `dev`/`main`, and on `workflow_dispatch`.

- The `ci` job runs `bun install --frozen-lockfile`, then these steps in order: **Lint & format**, **Type check**, **Architecture**, **Documentation**, **Environment**, **Build**.
- The `compose` job runs `config --quiet` on the dev, dev+mail and proxy files, on `docker-compose.yml`, on `deploy/docker-compose.yml` and on Coolify (with `exclude_from_hc` stripped). It also asserts that the production files fail when required values are empty.

**`scripts/dev.ts` and `dev-identity.ts`:**

- **Slug:** taken from `FREENARY_SLUG` (shell first, then the worktree's `.env`), else the branch (a detached HEAD doesn't count), else the directory name, else `dev`. It is lowercased, with every run of other characters turned into `-`, and capped at 40 characters.
- **Names it derives:** Compose project `freenary-<slug>`; hosts `{web,server,docs,mail}.<slug>.freenary.localhost` over plain HTTP; cookie domain `.<slug>.freenary.localhost`, which `AUTH_COOKIE_DOMAIN` can override.
- **Traefik:** only `up`/`start`/`restart`/`run`/`reset` touch it. It creates the `devproxy` network (subnet `172.30.0.0/16`, without the subnet if that fails). It reuses any running container that publishes port 80 on `devproxy`. If something else holds port 80, it errors and suggests `docker network connect`. Otherwise it starts `docker-compose.proxy.yml` (`traefik:v3.7`, project `devproxy-freenary`).
- **Dev stack:** services `postgres` (`postgres:18-alpine`, not on `devproxy`), a one-shot `bootstrap` (`prisma migrate deploy`), `server` (alias `freenary-server`, port 3000), `web` (3001), `docs` (4000). It publishes no host ports and has watch sync plus a rebuild on `bun.lock`.
- **Mail file:** adds `axllent/mailpit:v1.28` (alias `freenary-mailpit`, UI on 8025), and sets `EMAIL_PROVIDER=smtp`, `SMTP_HOST=freenary-mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false` and `EMAIL_FROM` on the server.

**Tests:** 62 `*.test.ts` files, under `apps/web/src`, `packages/{api,auth,email,instance-config,ui}` and `scripts/`. Run them with `bun test` or `bun test <path>`. CI runs none.

**Branches and releases:**

- PRs target `dev`.
- Pushes to `dev`/`main` publish images tagged `<branch>` and `sha-<short>`.
- `Release` is a `workflow_dispatch` with a `version` input, run from `main` only. It checks the version format and refuses an existing tag. For a stable version it requires `apps/fumadocs/content/docs/X.Y`; a pre-release skips that check. It then tags, builds images through `images.yml` and creates the GitHub release (`--prerelease` or `--latest`).

I changed no repository files.
