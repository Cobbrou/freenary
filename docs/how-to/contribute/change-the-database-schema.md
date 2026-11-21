---
title: Change the database schema
description: Edit the Prisma schema, create a migration and check that the stack applies it.
---

This page helps you change the database: you edit the Prisma schema, let Prisma write a migration (a folder of SQL that brings an existing database to the new schema), and check that a fresh stack applies it. Prisma is the database toolkit `packages/db` uses, at version `7.9.1`.

## Before you start

- The local path of [Run from source](run-from-source.md#run-the-apps-on-your-machine) up to step 5: PostgreSQL running from `docker-compose.yml`, `DATABASE_URL` in `apps/server/.env` and the existing migrations applied. `packages/db/prisma.config.ts` reads `DATABASE_URL` from `apps/server/.env`. The Docker development stack publishes no database port, so the Prisma CLI on your machine cannot reach its database.
- Where the files are, from `packages/db/prisma.config.ts`:
  - The schema is the folder `packages/db/prisma/schema/`. `schema.prisma` holds the `generator` and `datasource` blocks; the models sit in one file per area (`auth.prisma`, `budget.prisma`, `dashboard.prisma`, `instance.prisma` and others).
  - The migrations are in `packages/db/prisma/migrations/`. Each one is a folder named `<timestamp>_<name>`, such as `20261118110516_add_dashboards`, holding one `migration.sql`. `migration_lock.toml` records the provider, `postgresql`.
  - The generated client is in `packages/db/prisma/generated/`. Git ignores it.

## Steps

1. Edit the model in the matching file of `packages/db/prisma/schema/`, or add a file for a new area. The existing models name their table with `@@map`, such as `@@map("dashboard")`, and describe themselves with `///` comments.

2. Create the migration and apply it to your local database. Pass a snake_case name after the script:

   ```bash
   bun run db:migrate --name add_example
   ```

   The root script runs `turbo run db:migrate -F @freenary/db -- --name add_example`, and Turbo hands `--name add_example` to the `db:migrate` script of `packages/db`, which is `prisma migrate dev`. The task is `interactive` in `turbo.json`, so Prisma can ask you questions in the terminal. From `packages/db`, `bun run db:migrate --name add_example` does the same without Turbo.

   Prisma writes `packages/db/prisma/migrations/<timestamp>_add_example/migration.sql`. To read the SQL before it touches your database, add `--create-only`, then run the command again without it.

3. Regenerate the Prisma client, so the TypeScript types match the new schema:

   ```bash
   bun run db:generate
   ```

   `bun install` also runs it, through the `postinstall` script of `packages/db`.

4. Use the new fields through the client that `@freenary/db` exports:

   ```ts
   import prisma from "@freenary/db";
   ```

5. Run the type check, which covers every package that reads the client:

   ```bash
   bun run check-types
   ```

6. Commit the schema files and the new migration folder together.

### How the stack applies a migration

- `docker-compose.yml` runs the `migrate` service before `server`. It uses the server image, works in `/app/packages/db` and runs `bun x prisma migrate deploy`, which applies the migrations the database has not run yet. It runs again on every `docker compose up`, and `server` waits until it exits successfully.
- `docker-compose.dev.yml` does the same with its `bootstrap` service.
- `bun run db:push` (`prisma db push`) copies the schema to the database without writing a migration, so the stack never applies that change.

## Check that it works

1. Ask Prisma whether your database matches the migrations:

   ```bash
   (cd packages/db && bun x prisma migrate status)
   ```

   ```text
   Database schema is up to date!
   ```

2. Apply every migration to an empty database, the way a new install does. In the Docker development stack, `bun run dev:reset` removes the containers and the database volume, then starts again in the foreground; the `bootstrap` service runs all the migrations before `server` starts. From a second terminal, read its output with:

   ```bash
   bun scripts/dev.ts logs bootstrap
   ```

## If something goes wrong

- `Error: The datasource.url property is required in your Prisma config file when using prisma migrate status.` (or `migrate dev`) → `DATABASE_URL` is missing. Write it to `apps/server/.env`, as in step 4 of the local path of [Run from source](run-from-source.md#run-the-apps-on-your-machine).
- ``Error: P1001: Can't reach database server at `localhost:5432` `` → PostgreSQL is not running. Start it with `docker compose up -d --wait postgres`.
- `Following migrations have not yet been applied:` from `prisma migrate status` → your database is behind the migrations folder. Run `(cd packages/db && bun run db:migrate:deploy)`.
- Type errors on a new field after the migration → the client is stale. Run `bun run db:generate`.

## Related

- [Run from source](run-from-source.md)
- [Run the checks](run-checks.md)
- [Compose files](../../reference/compose-files.md)
- [Architecture](../../explanation/architecture.md)
