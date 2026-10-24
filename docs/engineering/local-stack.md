# Local development stack

The containerised path and the local path, the services, the hostnames, the database, the resets, and the checks, lint rules and pull request rules a change goes through.

Two paths run Freenary on your machine. The containerised path runs every part in Docker, and the local path runs the three applications on your host. Both need Docker for PostgreSQL.

| Path | Start it with | It needs | It gives you |
| --- | --- | --- | --- |
| Containerised | `bun run dev:up` | Docker, and port `80` free or held by the shared dev proxy | Five services, one hostname per application, one isolated stack per worktree |
| Local | PostgreSQL, `db:migrate:deploy`, then `bun run dev` | Docker and two variables in two files | Three host processes and PostgreSQL on `127.0.0.1:5432` |

## The containerised path

`bun run dev:up` is `bun scripts/dev.ts up --build --watch`. One command builds the images, applies the migrations and starts five services. `bun run dev:mail` adds a sixth service, Mailpit.

The stack needs no `.env` file. The `server` service declares `env_file` with `path: .env` and `required: false`, so an absent file is valid. Its `environment` block holds the seven values the stack derives: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `AUTH_COOKIE_DOMAIN`, `BANKING_PROVIDER` and `NODE_ENV`. Compose gives `environment` precedence over `env_file`, so those seven always win. `BANKING_PROVIDER` is the one that can be empty: `scripts/dev.ts` sets `mock` when the root `.env` names no bank provider, and otherwise passes the `.env` value, so an empty value leaves the schema default and the setup screen in charge. Every other variable of a root `.env` reaches the container.

### The services

`docker-compose.dev.yml` declares five services. Every service but `postgres` builds from `.docker/dockerfile.dev`. `docker-compose.mail.yml` adds the sixth, `mailpit`.

| Service | Image or build | Working directory | Command | Reachability |
| --- | --- | --- | --- | --- |
| `postgres` | `postgres:18-alpine` | image default | image default | `expose` only, plus the `pgdata` volume and a `pg_isready` health check |
| `bootstrap` | `.docker/dockerfile.dev` | `/app/packages/db` | `bun x prisma migrate deploy` | none. It gets `DATABASE_URL` alone |
| `server` | `.docker/dockerfile.dev` | `/app/apps/server` | `bun run --hot src/index.ts` | Traefik labels, port `3000` |
| `web` | `.docker/dockerfile.dev` | `/app/apps/web` | `bun run dev -- --host 0.0.0.0` | Traefik labels, port `3001` |
| `docs` | `.docker/dockerfile.dev` | `/app/apps/fumadocs` | `bun run dev -- --host 0.0.0.0` | Traefik labels, port `4000` |
| `mailpit` | `axllent/mailpit:v1.28` | image default | image default | Traefik labels, port `8025`. Only with `--mail` |

Only `server` loads the root `.env` and the derived values. The `web` service gets `VITE_SERVER_URL` and `SERVER_URL`, which defaults to `http://freenary-server:3000`. A server-rendered page therefore reaches the API over the container network. Only the default network of the stack knows that alias. It therefore never reaches the API of another worktree. The `docs` service gets `DOCS_PORT`, which no code reads.

The `web` and `docs` services also get `DEV_PUBLIC_URL`, their Traefik address. Their dev servers print that address in the logs, not the address inside the container. The `server` service prints `BETTER_AUTH_URL`.

The `bootstrap` service is one-shot. It waits for `postgres` to report healthy, then applies the migrations. The `server` service waits for it with the condition `service_completed_successfully`, so the schema lands first. Bootstrap re-runs on every `up`, and it exits `0` when the schema is already current.

### The five scripts

| Script | Literal command | The `docker compose` call |
| --- | --- | --- |
| `bun run dev:up` | `bun scripts/dev.ts up --build --watch` | `docker compose -p freenary-<slug> -f docker-compose.dev.yml up --build --watch` |
| `bun run dev:mail` | `bun scripts/dev.ts --mail up --build --watch` | the same prefix with a second `-f docker-compose.mail.yml`, then `up --build --watch` |
| `bun run dev:down` | `bun scripts/dev.ts down` | the same prefix, then `down` |
| `bun run dev:logs` | `bun scripts/dev.ts logs -f` | the same prefix, then `logs -f` |
| `bun run dev:reset` | `bun scripts/dev.ts reset` | `down -v`, then `up --build --watch` |

`reset` and `--mail` are the two arguments the wrapper owns. Every other argument reaches `docker compose` unchanged, always with the project name of this worktree:

```bash
bun scripts/dev.ts ps
bun scripts/dev.ts restart web
bun scripts/dev.ts exec server sh
```

### Hostnames

`scripts/dev-identity.ts` derives one slug per worktree. It takes the first source that answers:

| Order | Source |
| --- | --- |
| 1 | `FREENARY_SLUG`, read from the shell first and from the worktree `.env` second |
| 2 | The git branch name. A detached `HEAD` counts as no branch |
| 3 | The directory name of the worktree |
| 4 | The constant `dev` |

The `slugify` helper lowercases the name and collapses each run outside `[a-z0-9]` to one dash. It then trims the edge dashes and caps the result at 40 characters. The slug names six things:

| Field | Template | With `slug=dev` |
| --- | --- | --- |
| Compose project | `freenary-${slug}` | `freenary-dev` |
| Web host | `web.${slug}.freenary.localhost` | `web.dev.freenary.localhost` |
| Server host | `server.${slug}.freenary.localhost` | `server.dev.freenary.localhost` |
| Docs host | `docs.${slug}.freenary.localhost` | `docs.dev.freenary.localhost` |
| Mail host | `mail.${slug}.freenary.localhost` | `mail.dev.freenary.localhost` |
| Cookie domain | `.${slug}.freenary.localhost` | `.dev.freenary.localhost` |

The wrapper passes the cookie domain as `AUTH_COOKIE_DOMAIN`, so both origins share the session cookie. Every origin uses plain `http`. Chrome and Firefox treat each `*.localhost` origin as a secure context. The web app therefore works as it does over HTTPS. Safari does not, so use Chrome or Firefox.

The operating system sends every `*.localhost` name to `127.0.0.1`, so you edit no `/etc/hosts` file.

`dev:up` prints the banner before compose runs:

```bash
[freenary dev] worktree "<slug>"
  web     http://web.<slug>.freenary.localhost
  server  http://server.<slug>.freenary.localhost
  docs    http://docs.<slug>.freenary.localhost
  mail    http://mail.<slug>.freenary.localhost
  project freenary-<slug>
```

The `mail` line appears with `--mail` alone. The project name and the hostnames all carry the slug, so two worktrees run side by side. Each one gets its own containers, its own `pgdata` volume and its own URLs.

### The shared proxy

**No development service publishes a host port.** `postgres` uses `expose`, which opens nothing on the host. `server`, `web`, `docs` and `mailpit` join a second network, `devproxy`, and carry Traefik labels. One Traefik on port `80` reads those labels and routes each hostname to its container.

One proxy serves every stack on the machine. That includes each worktree of Freenary, and each other project on the `devproxy` network. The router names carry the slug, so two stacks never replace the routes of each other.

Before `up`, `start`, `restart`, `run` and `reset`, `scripts/dev.ts` does three checks:

1. It creates the `devproxy` network when it is absent. It uses the subnet `172.30.0.0/16` when that range is free.
2. It uses a running container that publishes port `80` on `devproxy`, when one exists. The banner then shows `proxy <name> (shared)`.
3. Otherwise it starts `docker-compose.proxy.yml`, a Traefik under the Compose project `devproxy-freenary`.

A container that holds port `80` off the `devproxy` network stops the start, and the message names it. `docker-compose.yml`, the self-hosting stack, never reads the proxy file.

`dev:down` leaves the proxy running, because another stack can use it. Stop the Freenary proxy yourself when no stack needs it:

```bash
docker compose -f docker-compose.proxy.yml down
```

### File sync

The `x-app-watch` anchor holds three rules, and `server`, `web` and `docs` share it.

| Action | Path | Target | Ignore |
| --- | --- | --- | --- |
| `sync` | `./apps` | `/app/apps` | `node_modules/`, `web/src/paraglide/` |
| `sync` | `./packages` | `/app/packages` | `node_modules/` |
| `rebuild` | `./bun.lock` | — | — |

An edit under `apps/` or `packages/` copies into the container and the hot reload picks it up. An edit to `bun.lock` rebuilds the image.

The paraglide ignore prevents one exact failure. Both sides compile that directory, so a sync of the host copy deletes the container copy mid-session. Vite then caches the failed resolution of `@/paraglide/server.js`, and the web app answers 500 until a restart. Never edit `apps/web/src/paraglide/` by hand: the next compile overwrites it. [Architecture](./platform.md#boundaries) holds the rule for the two message catalogs.

## The local path

```bash
cp .env.example .env
echo 'DATABASE_URL=postgresql://postgres:password@localhost:5432/freenary' > apps/server/.env
docker compose up -d --wait postgres
(cd packages/db && bun run db:migrate:deploy)
bun run dev
```

The API server does not migrate at boot, so the schema step is not optional: without it the server exits at startup, because it reads the `instance_setup` table. `bun install` already generated the Prisma client.

| Command | What it does |
| --- | --- |
| `docker compose up -d --wait postgres` | Starts PostgreSQL from `docker-compose.yml` and waits for its `pg_isready` health check. It publishes `127.0.0.1:5432` and names the database `freenary`. `bun run db:start` is the same call without `--wait` |
| `(cd packages/db && bun run db:migrate:deploy)` | `prisma migrate deploy`. The script lives in `packages/db` alone. It applies every migration to the empty database |
| `bun run dev` | `turbo run dev` for the three applications |
| `bun run dev:web`, `bun run dev:server` | The same task for one application |
| `bun run db:watch`, `bun run db:stop`, `bun run db:down` | Follow, stop and remove the same PostgreSQL container |

> [!WARNING] **`docker-compose.yml` needs two variables, not a file.** It writes `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` as `${VAR:?…}`, which fails on an unset or empty value from any source. A shell export satisfies that check, but the `server` service also reads `env_file: .env`, so the file must exist. The CI `compose` job proves the rule. It parses the file with an emptied `.env`, and it fails when the parse succeeds.

The Prisma CLI reads its own file. `packages/db/prisma.config.ts` loads `apps/server/.env` with dotenv, then hands `process.env.DATABASE_URL || undefined` to the datasource. It sets no default on purpose, so `db:generate` works in a checkout with no database. The commands that connect — `db:migrate:deploy`, `db:migrate`, `db:push` and `db:studio` — need `DATABASE_URL` in `apps/server/.env`, which the second line above writes:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/freenary
```

The password is the `POSTGRES_PASSWORD` of the root `.env`. The schema default for that variable is the same URL.

### The ports

| Application | Port | Where the port comes from |
| --- | --- | --- |
| API server | `3000` | `env.PORT`, default `3000` |
| Web app | `3001` | `server.port` in `apps/web/vite.config.ts`, with `allowedHosts: true` |
| Documentation site | `4000` | The `--port=4000` flag in the `dev` script of `apps/fumadocs` |

> [!CAUTION] **`apps/fumadocs/vite.config.ts` declares `port: 3000`, and the `dev` script overrides it with `--port=4000`.** Run `bun run dev` or `bun run dev:up` and the site answers on `4000`. Run `vite dev` inside that app by hand and it takes `3000`, which collides with the API server. Always start the site through its `dev` script.

## Add an environment variable

Declare it once, in `packages/env/src/schema.ts`. Give it a Zod schema, a `.describe()` sentence, and a `.meta()` block with its `section`, `example` and `onError`. Then run the generator:

```bash
bun run env:sync
```

`env:sync` writes `.env.example` and the tables of the [Configuration](../../apps/fumadocs/content/docs/next/reference/configuration.mdx) reference. No compose file needs an edit. The development `server` service already reads the root `.env` through `env_file`, and the production one does the same. A `pre-commit` job runs the generator and stages what it writes.

`bun run env:check` is the same script in check mode, and it is the `Environment` step of CI. It refuses four mistakes. A schema key with no description, no example or no `onError` fails. A `process.env` read under `apps/`, `packages/` or `scripts/` that nothing declares fails. A `${VAR}` in a compose file that nothing declares fails, and so does an unused allow-list entry.

## Reach the database

On the containerised path nothing is published, so go through the wrapper:

```bash
bun scripts/dev.ts exec postgres psql -U postgres -d freenary
```

On the local path PostgreSQL answers on `127.0.0.1:5432`, so `psql` and `bun run db:studio` reach it straight.

### The database commands

| Command | Prisma command | Use it for |
| --- | --- | --- |
| `bun run db:migrate --name <snake_case>` | `prisma migrate dev` | Every schema change you commit |
| `bun run db:generate` | `prisma generate` | A fresh client after a schema edit or a branch switch |
| `bun run db:studio` | `prisma studio` | A table browser on the database in `DATABASE_URL` |
| `bun run db:migrate:deploy` | `prisma migrate deploy` | Apply pending migrations. It lives in `packages/db` alone, with no root passthrough |
| `bun run db:push` | `prisma db push` | A scratch database only. It writes no migration history, so it drifts a migrated database |

[Data model](./data-model.md#migrations) holds the migration rules and the whole list of migrations.

## Your first account

The repository holds no seed script. Open the web app and create the account on the sign-in screen.

`bun run dev:up` configures no email provider. Freenary therefore hides every flow that needs mail. Sign-up returns a session at once, and no screen asks for a code.

Work on those flows through `bun run dev:mail`. It sets `EMAIL_PROVIDER` to `smtp` and points the server at Mailpit. Sign-up then asks for a one-time code, and Mailpit holds the message at `http://mail.<slug>.freenary.localhost`.

Read the code in that inbox, then type it in the form. The local path sets no email provider either, so a sign-up there returns a session at once.

## Reset

`bun run dev:reset` destroys the `pgdata` volume of this worktree, so every row goes. The next `up` re-runs `bootstrap`, and you get an empty database with a current schema. The command touches no other project name, so the volume of another worktree survives.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| A permanent 500 that names `@/paraglide/server.js` | Vite cached a failed resolution after the paraglide directory vanished | `bun scripts/dev.ts restart web` |
| Prisma methods or types that do not match the schema | A stale generated client | `bun run db:generate` |
| `bind: address already in use` on `3000` | Another `bun run dev`, or a bare `vite dev` inside `apps/fumadocs` | Stop that process, or start the site through its `dev` script |
| `bind: address already in use` on `3001` or `4000` | Another host process holds the port | Stop it, or use the containerised path, which publishes no application port |
| `bind: address already in use` on `80` when the proxy starts | A process outside Docker holds port `80` | Stop that process, then run `bun run dev:up` again |
| Every hostname answers `404 page not found` | The proxy has no route for that name, because the stack of that slug is not running | `bun scripts/dev.ts ps`, then `bun run dev:up` |
| The production compose file refuses to parse | An unset or empty `POSTGRES_PASSWORD` or `BETTER_AUTH_SECRET` | Set both in the root `.env` |
| A route the router does not know, or type errors in `routeTree.gen.ts` | A stale generated route tree | Restart the web development server |
| Merchant names are never matched, and fewer transactions get a category | The merchant dictionary artifact is absent | `bun run build:data` on the host |

## What you need

| Tool | Version | Why you need it |
| --- | --- | --- |
| Bun | `1.3.14` | The runtime, the package manager and the test runner. `packageManager` in the root `package.json` pins it locally. CI installs `bun-version: latest` instead. |
| Docker | Any current release | Both stack paths run PostgreSQL in a container. |
| Port `80` | Free, or held by a Traefik on the `devproxy` network | The containerised path only. One shared proxy on that port serves every stack. |
| PostgreSQL | `18` | The image `bun run db:start` starts for you. You install nothing by hand. |

The repository holds a `.nvmrc` file with the content `v25.6.1`. No script and no workflow reads it. Bun runs everything here.

## First-time setup

### Clone and install

```bash
git clone https://github.com/suiramdev/freenary.git
cd freenary
bun install
```

`bun install` also runs the `postinstall` script of `@freenary/db`, which runs `prisma generate`. The client lands in `packages/db/prisma/generated`. It needs the schema files, not a live database.

### Build the merchant data once

```bash
bun run build:data
```

The categorisation pipeline reads `packages/api/data/merchants.jsonl.gz`. The development image `.docker/dockerfile.dev` does not build that artifact, and only the production server image does. Run the command on your host before you start the stack. [Transaction categorisation](./categorisation.md) covers the artifact.

### Start the stack

Pick one of the two paths above. Then create your account in the browser.

## The checks before a pull request

`.github/workflows/ci.yml` declares two jobs, `ci` and `compose`. GitHub starts both on every pull request, and on every push to `dev` and `main`. The file also declares `workflow_dispatch`, which [Dependency updates](./dependencies.md) explains. The `ci` timeout is 10 minutes and the `compose` timeout is 5 minutes.

The `ci` job runs seven commands. Run the same seven before you open a pull request:

```bash
bun install --frozen-lockfile
bun run check
bun run check-types
bun run check:fsd
bun run docs:check
bun run env:check
bun run build
```

| Order | CI step name | Command | What it covers |
| --- | --- | --- | --- |
| 1 | _(unnamed)_ | `bun install --frozen-lockfile` | The lockfile matches the manifests |
| 2 | Lint & format | `bun run check` | `ultracite check` over the whole repository |
| 3 | Type check | `bun run check-types` | `turbo run check-types` |
| 4 | Architecture | `bun run check:fsd` | `turbo run lint:fsd`, the Feature-Sliced Design rules of `apps/web` and `apps/fumadocs` |
| 5 | Documentation | `bun run docs:check` | `turbo run docs:check`, which reaches `apps/fumadocs` |
| 6 | Environment | `bun run env:check` | `scripts/env-sync.ts --check`, which compares `.env.example` and the configuration reference against `packages/env/src/schema.ts` |
| 7 | Build | `bun run build` | `turbo run build`, which builds the three applications |

The `compose` job needs no Bun and no install. It runs `docker compose config --quiet` eight times:

- Against `docker-compose.dev.yml`, the development stack.
- With `-f docker-compose.mail.yml` added, the Mailpit layer over it.
- Against `docker-compose.proxy.yml`, the development proxy.
- Against `docker-compose.yml`, the production stack, with a temporary `.env` that sets `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`.
- Against `docker-compose.yml` with an empty `.env`, which must fail. A pass means the production file accepted two empty secrets, so the job fails.
- Against `deploy/docker-compose.yml`, with a temporary `deploy/.env` that sets `FREENARY_URL`, `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`.
- Against `deploy/docker-compose.yml` with an empty `deploy/.env`, which must fail in the same way.
- Against `deploy/coolify.yml`, with the Coolify-only `exclude_from_hc` lines removed and the three `SERVICE_*` values set in the shell.

That job is the one CI check no root script covers. Reproduce it from `.github/workflows/ci.yml` before you change any of these compose files.

> [!WARNING] `bun run check-types` reaches every workspace, `apps/web` included, which checks its test files too. The web check runs after its `build`, because the build generates `src/routeTree.gen.ts` and `src/paraglide/`, so the first run in a fresh checkout takes as long as a web build.

### Tests run by hand, one file at a time

CI runs no tests. No `package.json` in the repository declares a `test` script, and `turbo.json` declares no `test` task. Run the files your change touches:

```bash
bun test scripts/dev-identity.test.ts
bun test packages/api/src
```

Test files are named `*.test.ts` or `*.test.tsx`.

Assertions sit inside `it()` or `test()`. Suites stay flat, no test uses a done callback, and no `.only` or `.skip` reaches a commit.

## Format and lint

```bash
bun run fix     # ultracite fix, writes the fixes
bun run check   # ultracite check, reports only
```

Both skip Turborepo and cover the whole repository. Ultracite wraps two tools: Oxlint for the rules and Oxfmt for the format. On top of them, the repository enables the `oxslop` plugin, which adds 39 rules at `error`. A TypeScript lint config needs Bun or Node 22.18 and newer, so run `bunx --bun oxlint` when you call Oxlint directly.

| File | What it sets |
| --- | --- |
| `oxlint.config.ts` | Extends the Ultracite `core`, `react` and `tanstack` presets and the fragment that `oxslop/config` builds. That fragment carries the oxslop plugin, its rules and its test-file overrides. Loads the `@shadcn/lint` plugin through `jsPlugins`. Ignores `packages/ui/**` and `apps/web/src/paraglide/**`. |
| `apps/fumadocs/.oxlintrc.json` | Extends the `presets/all.json` file of oxslop through a relative path, because Oxlint resolves `extends` against the config file and refuses a package name. Loads `@shadcn/lint` as well, because the `lint` script of this application reads this file. |
| `oxfmt.config.ts` | Spreads the Ultracite format config. It does not ignore `packages/ui/**`, so Oxfmt formats that package and Oxlint does not lint it. |

`@shadcn/lint` is a design-system linter for Tailwind. It reads the components, the variants and the theme of the project. An error from it can therefore name the size, the token or the file to use instead. The repository registers the plugin and enables no rule of it yet.

`settings.shadcn.componentImports` declares the `@/shared/ui` alias that both applications use for their own compositions. `apps/web/components.json` supplies the rest: the primitives in `@freenary/ui/components`, and the theme in `packages/ui/src/styles/globals.css`. To switch a rule on, read its [rule list](https://github.com/shadcn-ui/lint/blob/main/README.md#rules). The [configuration examples](https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md) show contracts and custom messages. A rule must stay off for `packages/ui`, because the components there are the design system.

Four of the added rules change how the code is written. `no-comments` rejects every comment except a `SAFETY:` justification and a tooling directive. A name therefore carries what a comment used to say. `no-try-catch` and `no-switch` send failure handling and dispatch to Effect. `no-vague-identifiers` refuses a placeholder name such as `data` or `result`.

A comment therefore never holds a fact. `docs/engineering/` in the repository holds one file per area. Each bullet names the file and the symbol it belongs to. Read the file for the area you change, and add to it when the code cannot state what you learned.

`lefthook.yml` declares one hook. On `pre-commit` it runs three jobs in parallel:

| Job | Command |
| --- | --- |
| `oxlint` | `bun oxlint --fix --no-error-on-unmatched-pattern {staged_files}` |
| `oxfmt` | `bun oxfmt --write {staged_files}` |
| `env-sync` | `bun run env:sync` |

All three set `stage_fixed: true`, so each job re-stages the files it changed. The `oxlint` job runs only when a JavaScript or TypeScript file is staged. The `env-sync` job runs on a change to the environment schema, a compose file or the generator. The repository declares no `pre-push` hook and no `commit-msg` hook.

## Branches, commits and pull requests

Two branches live for ever. Every pull request targets `dev`, and `main` holds released code. [Release a version](./releasing.md) covers how a version becomes a tag.

Branch names describe the change. `.github/CONTRIBUTING.md` names three good examples and three to avoid:

| Good                             | Avoid     |
| -------------------------------- | --------- |
| `fix/login-redirect-loop`        | `test`    |
| `feat/portfolio-holdings-view`   | `misc`    |
| `chore/update-contributor-guide` | `changes` |

The repository holds no commitlint config and no `commit-msg` hook, so nothing checks the subject line. Write a subject that names what changed.

Sign off every commit:

```bash
git commit -s -m "fix: stop the login redirect loop"
```

The `-s` flag appends a `Signed-off-by` trailer. The trailer certifies the [Developer Certificate of Origin](https://developercertificate.org). It states that you wrote the change, or that you hold the right to contribute it.

### The license of your contribution

Freenary is free software under the GNU Affero General Public License, version 3 or later. A pull request licenses its contribution under the same terms.

Two rules follow from that license:

- A new dependency must carry a license that the AGPL can distribute. MIT, ISC, BSD, Apache-2.0 and MPL-2.0 all qualify. A proprietary license does not, and a stronger copyleft such as the SSPL does not.
- A file that you copy into the repository keeps the copyright notice of its source. Put that notice in `THIRD-PARTY-NOTICES.md`.

The license text is `LICENSE`, and the notices of the bundled third-party software are in `THIRD-PARTY-NOTICES.md`.

### The pull request body

`.github/pull_request_template.md` declares six headings. Fill each one except Evidence, which is optional, and keep each one short. The whole body stays near 400 words, not counting images and video. The summary stays near four sentences, and the middle three sections near four bullets each.

| Section | What it carries |
| --- | --- |
| Summary | What changed, and what a reviewer reads first. |
| Motivation | Why the change is worth it. |
| Drawbacks | The honest costs. |
| Prior art | The alternatives you rejected. |
| Evidence | Optional. Screenshots, a screen recording or other proof, uploaded by dragging them into the description. Fake data only, with no keys, tokens, personal data or local paths. Delete it when it does not apply. |
| Notes | One line per fact: linked issue, visual change, tests, documentation pages, migration, breaking change. |

Never restate the issue in the body, and never paste command output into it.

### What a reviewer expects

- The pull request opens against `dev`.
- It explains the user-visible change.
- It stays on a single topic.
- Its Evidence section carries screenshots or a screen recording for new interface work. A reviewer or QA asks for them when they are missing; no check fails. With no visual change, Notes says so.
- It names the `apps/fumadocs` pages it updated, or states that none needed a change.

A change to documented behaviour owes a documentation update in the same pull request. A screen, an API route, an environment variable, a `packages/db` enum, a script and a bank provider all count. [Writing documentation](./writing-docs.md) holds the rules for that update.

Check an interface change in the browser, in light mode and in dark mode. A tag and a version bump are maintainer work, so leave both out.

### Issues

`.github/ISSUE_TEMPLATE/config.yml` sets `blank_issues_enabled: false`, so every issue starts from one of three forms: Bug report, Feature request and Other. None adds a title prefix or a label; the `Triage` workflow labels the issue, as [Contribute](../../apps/fumadocs/content/docs/next/contribute.mdx#labels) describes.

## Where the rules live

| Source | Scope |
| --- | --- |
| [`.github/CONTRIBUTING.md`](https://github.com/suiramdev/freenary/blob/main/.github/CONTRIBUTING.md) | Branch names, the pre-pull-request checks, the pull request rules, the sign-off and the license of a contribution |
| [`CONTEXT.md`](https://github.com/suiramdev/freenary/blob/main/CONTEXT.md) | The product vision and the glossary of each domain term |
| [`AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/AGENTS.md) | The repository-wide working rules, and the documentation duty |
| [`LICENSE`](https://github.com/suiramdev/freenary/blob/main/LICENSE) | The GNU Affero General Public License, version 3, under which Freenary is distributed |
| [`THIRD-PARTY-NOTICES.md`](https://github.com/suiramdev/freenary/blob/main/THIRD-PARTY-NOTICES.md) | The license notices of the vendored and the bundled third-party software |

Each workspace states its own rules next to its code:

- [`apps/web/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/apps/web/AGENTS.md)
- [`apps/server/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/apps/server/AGENTS.md)
- [`apps/fumadocs/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/apps/fumadocs/AGENTS.md)
- [`packages/api/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/api/AGENTS.md)
- [`packages/auth/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/auth/AGENTS.md)
- [`packages/db/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/db/AGENTS.md)
- [`packages/email/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/email/AGENTS.md)
- [`packages/env/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/env/AGENTS.md)
- [`packages/ui/AGENTS.md`](https://github.com/suiramdev/freenary/blob/main/packages/ui/AGENTS.md)

## Related

- [Data model](./data-model.md) — the schema, the enums and the migration loop.
- [Platform](./platform.md) — what each workspace owns, and the path of one request.
- [Contribute](../../apps/fumadocs/content/docs/next/contribute.mdx) — the short version, on the documentation site.
