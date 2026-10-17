# `packages/db` — Data Layer

Single-database data layer backed by Prisma ORM.

- **Schema** — `prisma/schema/*.prisma` (multi-file schema). The entry point is `prisma/schema/schema.prisma`; additional models live in sibling `.prisma` files in the same directory.
- **Migrations** — `prisma/migrations/`. Each migration is a timestamped directory containing a `migration.sql` file, managed by Prisma Migrate.

## Migrations (strict)

Schema changes ship as **versioned migration files** and are applied with `db:migrate`. That is the only supported mechanism: dev bootstrap and runtime provisioning both migrate, so every database carries a recorded history. `db:push` is dev tooling for a scratch database (see below), never the way schema reaches a shared database.

**Every schema edit follows this loop:**

1. Edit the schema files under `prisma/schema/`.
2. Generate the migration through the CLI with a descriptive name (run from `packages/db`):
   ```bash
   bun run db:migrate --name <descriptive_name>
   ```
3. Review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` — Prisma can emit destructive statements; read the diff before trusting it.
4. In production, apply with `bun run db:migrate:deploy`.
5. Commit the schema change **and** its generated migration together.

**Rules — non-negotiable:**

- **Always pass `--name <descriptive_snake_case>`.** Never accept Prisma's default timestamp-only slug. Name the change for what it does — `add_mission_reviews`, `drop_legacy_token`. The baseline migration is `init`.
- **Never hand-write, hand-edit, or hand-rename a migration.** Regenerate through the CLI so the SQL and the migration history stay in lockstep.
- **Never edit or delete a migration once it has shipped** (merged, or applied anywhere). Fix forward with a new named migration.
- **A schema edit and its migration land in the same commit/PR** — never one without the other.

## `db:push` is for scratch databases

`db:push` diffs the schema straight onto a database with no version history and would drift a migrated database. It is not the setup mechanism, and nothing stops it from running against a migrated database:

```bash
bun run db:push   # scratch/local database only
```

Use it only for fast iteration on a throwaway local database; before committing, capture the change as a named migration per the loop above.
