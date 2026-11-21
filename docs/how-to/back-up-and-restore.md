---
title: Back up and restore
description: Save the PostgreSQL database and bring it back.
---

This page saves everything Freenary stores, and brings it back on the same server or on a new one. A backup has two parts: a dump of the PostgreSQL database, made with `pg_dump` inside the `postgres` container, and a copy of `.env`. The commands below work with `docker-compose.yml` and with `deploy/docker-compose.yml`.

## Before you start

- Freenary runs, and you are in the folder that holds `docker-compose.yml` and `.env`. To restore on a new server, that server has Docker and the same Compose file in a folder of its own.
- You have a place outside the server to keep the backup files.
- You know what a backup is made of. It needs both files below; keep them together and private, because `.env` holds every secret of the instance:
  - **The database dump.** It holds the accounts, bank connections, transactions, budgets and the settings the operator saved in the app.
  - **`.env`.** It holds `BETTER_AUTH_SECRET`, and the dump is not enough without it. The server seals each saved setting and each bank connection token with a key derived from that secret. The secret also signs the session cookies and encrypts two-factor secrets and backup codes. See [Where settings come from](../explanation/settings-sources.md#how-saved-settings-are-protected).

## Steps

### Make a backup

1. Dump the database to a file on the host:

   ```bash
   docker compose exec -T postgres pg_dump -U postgres -d freenary --format=custom > freenary.dump
   ```

   `-T` turns off the terminal, so the binary dump reaches the file intact. `--format=custom` writes a compressed file that `pg_restore` reads.

2. Copy `.env` beside it:

   ```bash
   cp .env freenary.env
   ```

3. Write down the release the server runs:

   ```bash
   docker compose exec server printenv FREENARY_BUILD_VERSION
   ```

   A release image prints its version, for example `1.2.0`. Images built from a branch print the branch name (`main`, `dev`), and images built before this variable existed print nothing. Keep the value with the backup.

4. Move `freenary.dump` and `freenary.env` off the server.

### Restore a backup

1. Put the backed-up `.env` in place, next to `docker-compose.yml`:

   ```bash
   cp freenary.env .env
   ```

2. Stop the API server and the web app, so nothing writes to the database during the restore:

   ```bash
   docker compose stop server web
   ```

   On a new server, start the database alone instead:

   ```bash
   docker compose up -d --wait postgres
   ```

3. Restore the dump:

   ```bash
   docker compose exec -T postgres pg_restore -U postgres -d freenary --clean --if-exists --no-owner < freenary.dump
   ```

   `--clean --if-exists` drops each table before it recreates it, so the restore replaces the data that was there.

4. Start the whole stack:

   ```bash
   docker compose up -d
   ```

   The `migrate` service checks the schema and prints `No pending migrations to apply.` when the dump comes from the same version.

## Check that it works

1. Count the accounts in the restored database:

   ```bash
   docker compose exec postgres psql -U postgres -d freenary -c 'select count(*) from "user"'
   ```

   The count matches the number of accounts at the time of the backup.

2. Read the server log:

   ```bash
   docker compose logs server
   ```

   It does not show `This instance has no operator yet.`, because the operator came back with the dump. It shows no line that ends in `does not open with the current BETTER_AUTH_SECRET.`

3. Sign in with an account from the backup.

## If something goes wrong

- The server log shows `The stored value of BANKING_PROVIDER does not open with the current BETTER_AUTH_SECRET.`, one line per saved setting. `.env` holds another `BETTER_AUTH_SECRET` than the one the backup was made with. The server runs as if those settings were never saved. Put the original `.env` back and run `docker compose up -d`. Without it, save the settings again in the app.
- The server log shows `[bank] The … token of user … does not open with the current BETTER_AUTH_SECRET. Connecting a bank again replaces it; the banks linked before keep failing until they are disconnected.` Same cause. Put the original `.env` back, or have the member connect the bank again.
- `docker compose up -d` stops with `service "migrate" didn't complete successfully: exit 1`, and `docker compose logs migrate` shows `Error: P1000: Authentication failed against database server`. `POSTGRES_PASSWORD` in `.env` differs from the password the database volume was created with. PostgreSQL sets that password once, when the volume is new. Put the original `POSTGRES_PASSWORD` back.
- You restored a dump made with a newer version than the image you run. `migrate` only moves the schema forward, so it prints `No pending migrations to apply.` and the older server runs against the newer schema. Set `FREENARY_VERSION` in `.env` to the version you wrote down when you made the backup, then run `docker compose pull` and `docker compose up -d`.

## Related

- [Update Freenary](update-freenary.md)
- [Where settings come from](../explanation/settings-sources.md)
- [Compose files](../reference/compose-files.md)
