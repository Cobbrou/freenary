The audit is done, and the backup round trip works. I tore down the throwaway stack and its volume, and changed no repo files. The full report is in `local://run-instance-audit.md`.

**Backup and restore.** I ran these against a throwaway `postgres:18` from the root compose file, with all 12 migrations applied:

- **Backup:** `docker compose exec -T postgres pg_dump -U postgres -d freenary -Fc > freenary.dump`
- **Restore over the live database:** `pg_restore -U postgres -d freenary --clean --if-exists --no-owner < freenary.dump` exited 0, and the test row came back.
- **Restore into an empty database on a fresh volume:** `pg_restore --no-owner` exited 0.
- **Plain SQL:** a `pg_dump` text dump loaded back with `psql -v ON_ERROR_STOP=1` also worked, `citext` extension included.
- **Not run:** the docs' exact `dropdb --force` then `createdb` sequence. It should behave like the fresh-database case.

**Failures I reproduced, with their exact messages:**

- **Empty `.env`:** compose stops with `required variable POSTGRES_PASSWORD is missing a value: Set POSTGRES_PASSWORD in .env`, and the same for `BETTER_AUTH_SECRET`.
- **No `.env` file at all**, even with the variables exported: `env file …/.env not found`. The root compose file requires the file to exist.
- **`POSTGRES_PASSWORD` changed after the first start:** migrate fails with `Error: P1000: Authentication failed…`, then `service "migrate" didn't complete successfully: exit 1`.
- **Bad environment in the server image:** the log shows `❌ Invalid environment variables` with `path`/`message` entries, and the container loops on `Restarting (1)`.
- **Half-set email variables:** the server loops on `error: EMAIL_PROVIDER=resend requires RESEND_API_KEY to be set.`
- **Database unreadable when the server starts in production:** it dies with `The instance configuration could not be read: …`. In development it only warns.
- **Different `BETTER_AUTH_SECRET`:** the log shows `WARN … The stored value of EMAIL_PROVIDER does not open with the current BETTER_AUTH_SECRET.` The stored value is dropped and the server still starts.

**Checked against the code and better-auth 1.7.1** (it all matches the `run/` pages):

- One-time codes: 6 digits, 10 minutes, 3 attempts, at most 3 sends a minute.
- Sessions: 7 days. `updateAge` isn't set, so better-auth's default of 1 day applies, which makes the docs' "6 to 7 days" correct.
- Passwords: 12 to 128 characters.
- The rate-limit table and the 15-minute re-authentication window.
- Passkeys are tied to the hostname of `CORS_ORIGIN`.
- The leaked-password errors, both `Failed to check password…` variants.
- The email subjects.

**Provider callbacks:** they are `/api/auth/callback/{google,apple,oidc}`. In better-auth 1.7.1, generic OAuth goes through the core `/callback/:id` route, not `/oauth2/callback`, so the docs are right.

**Gaps in the docs:**

1. **Provider sign-in on an instance without email.** better-auth only joins a provider sign-in to an existing account when that account's address has been confirmed. Without email, password accounts are never confirmed, so a Google, Apple or SSO sign-in with the same address is refused ("account not linked"). `run/sign-in.mdx` says "same, confirmed email address" but doesn't spell out this consequence.
2. **Missing troubleshooting rows.** The "Freenary won't start" table in `run/troubleshooting.mdx` has no row for `The instance configuration could not be read` or for the missing `.env` file error.
