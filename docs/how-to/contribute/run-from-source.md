---
title: Run from source
description: Run the development stack from a clone of the repository.
---

This page helps you run Freenary from your working tree, so your edits show up in the running apps. You can run everything in Docker with `bun run dev:up`, or run the apps on your machine and only PostgreSQL in Docker.

## Before you start

- A clone of `https://github.com/suiramdev/freenary`, with your shell in its root folder.
- Bun 1.4.2, the version in the `packageManager` field of `package.json`.
- Docker with Compose.
- For the Docker path: [Kiri](https://docs.runkiri.com/domains/), a Docker engine that routes hostnames to containers. You can use your own router instead (see step 4).

## Steps

### Run everything in Docker

1. Install the dependencies:

   ```bash
   bun install
   ```

2. Start the stack:

   ```bash
   bun run dev:up
   ```

   `scripts/dev.ts` runs `docker compose -p freenary-<slug> -f docker-compose.dev.yml up --build --watch`. The slug is your git branch name turned into a hostname label (`FREENARY_SLUG` overrides it; a detached HEAD falls back to the folder name, then `dev`). The stack runs `postgres`, `bootstrap` (applies the migrations, then exits), `server`, `web` and `docs`, built from `.docker/dockerfile.dev`. Compose watch copies every edit under `apps/`, `packages/` and `docs/` into the containers, and rebuilds them when `bun.lock` changes.

3. Open the URLs the script prints first. For a branch named `my-branch` on macOS:

   ```text
   [freenary dev] worktree "my-branch"
     web     https://web.my-branch.freenary.kiri.localhost
     server  https://server.my-branch.freenary.kiri.localhost
     docs    https://docs.my-branch.freenary.kiri.localhost
     project freenary-my-branch
   ```

   No service publishes a host port: Kiri reads the `dev.kiri.domain` and `dev.kiri.http.port` labels of each service. The scheme is `https` on macOS and `http` elsewhere.

   > **TODO (unverified):** how to turn on HTTPS in the Kiri app on macOS.

4. To route the hostnames with something other than Kiri, set `FREENARY_DEV_DOMAIN` (replaces `kiri.localhost`) and `FREENARY_DEV_SCHEME` (`http` or `https`) in your shell or in a root `.env` file. See [Development stack variables](../../reference/configuration.md#development-stack-variables).

5. Optional: start the stack with an extra service instead of `dev:up`:

   - `bun run dev:mail` adds `docker-compose.mail.yml`: a Mailpit inbox at `mail.<slug>.freenary.<domain>`, and the server sends email through it (`EMAIL_PROVIDER=smtp`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`). Without it the stack has no email provider, so the flows that send codes stay hidden.
   - `bun run dev:ai` adds `docker-compose.ai.yml`: a scripted OpenAI-compatible model (`emulate@0.14.0`) that answers from the rules in `.docker/ai-rules.yaml`, and sets `AI_BASE_URL=http://ai:4000/v1` and `AI_MODEL=emulated`. No API key is needed.

6. Manage the stack with the other scripts:

   - `bun run dev:logs` follows the logs.
   - `bun run dev:down` stops and removes the containers.
   - `bun run dev:reset` removes the containers and the database volume, then starts again.

The stack needs no `.env` file. A root `.env`, if you have one, reaches the containers through an optional `env_file`. The values the stack derives from the worktree (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `AUTH_COOKIE_DOMAIN`, `NODE_ENV`) win over it.

### Run the apps on your machine

1. Install the dependencies:

   ```bash
   bun install
   ```

2. Create the root `.env` that `docker-compose.yml` needs, with a generated secret:

   ```bash
   cp .env.example .env
   sed -i.bak "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" .env && rm .env.bak
   ```

3. Start PostgreSQL alone. It listens on `127.0.0.1:5432`:

   ```bash
   docker compose up -d --wait postgres
   ```

4. Tell the Prisma CLI and the server where the database is. `packages/db/prisma.config.ts` reads `apps/server/.env`:

   ```bash
   echo 'DATABASE_URL=postgresql://postgres:password@localhost:5432/freenary' > apps/server/.env
   ```

5. Apply the migrations:

   ```bash
   (cd packages/db && bun run db:migrate:deploy)
   ```

6. Start the apps:

   ```bash
   bun run dev
   ```

   Turbo runs each app's `dev` script: the server on `http://localhost:3000` (`PORT`), the web app on `http://localhost:3001` (`apps/web/vite.config.ts`) and the docs site on `http://localhost:4000` (`apps/fumadocs/package.json`). `bun run dev:web` and `bun run dev:server` start one app.

### Use the mock bank

Outside production, the **Bank provider** step of the setup screen also lists **Mock bank (development only)**. Pick it to finish setup with no bank account and no credentials. The `mock` provider (`packages/api/src/providers/mock`) offers three made-up banks (Banque Lumière, Crédit Mistral, Néobanque Azur) and serves its own consent page at `/mock-bank/consent` on the API server, with **Decline** and **Approve** links. Its accounts, transactions and holdings are generated with Faker, seeded from the account and the day, so a day's data is the same on every sync. Each consent also adds **Compte multidevise**, a current account holding euros and dollars, with a monthly expense refund in euros, an exchange between the two, payments in dollars and a payment made in pounds. `BANKING_PROVIDER=mock` in `.env` selects it too. The server refuses `mock` when `NODE_ENV` is `production`.

## Check that it works

```bash
bun scripts/dev.ts config --services
```

```text
postgres
bootstrap
server
web
docs
```

On the local path, open `http://localhost:3001` and create the first account: there is no seed script.

## If something goes wrong

- `[freenary dev] Docker runs on <engine>, not Kiri, so nothing routes these hostnames.` → Docker is not using Kiri. Run `docker context use kiri`, or route the hostnames yourself and set `FREENARY_DEV_DOMAIN`.
- `[freenary dev] FREENARY_DEV_SCHEME must be http or https.` → fix the value in your shell or `.env`.
- `required variable POSTGRES_PASSWORD is missing a value: Set POSTGRES_PASSWORD in .env` (or `BETTER_AUTH_SECRET`) → `docker-compose.yml` needs both values in the root `.env`; redo step 2 of the local path.
- `docker compose up -d --wait postgres` fails because port 5432 is taken → another PostgreSQL uses it. Set `POSTGRES_PORT=5433` in the root `.env` and use `localhost:5433` in `apps/server/.env`.

## Related

- [Commands](../../reference/commands.md)
- [Compose files](../../reference/compose-files.md)
- [Run the checks](run-checks.md)
