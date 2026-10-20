# Run-an-instance audit (2026-10-17)

## Verified facts (source)

- Email: EMAIL_PROVIDER resend|smtp; resend needs RESEND_API_KEY+EMAIL_FROM; smtp needs EMAIL_FROM+SMTP_HOST; SMTP_PORT default 465 if SMTP_SECURE else 587; SMTP_PASSWORD only used when SMTP_USER set (packages/email/src/registry.ts). Setup-screen probe: resend GET https://api.resend.com/domains (needs full-access key); smtp transport.verify(); 10 s timeout (instance-config/src/probe.ts).
- Subjects (auth/src/emails.ts): "Confirm your Freenary email address", "Reset your Freenary password", "Confirm your new Freenary email address", "Your Freenary verification code". Plain text.
- OTP: 6 digits, 600 s, 3 attempts, stored hashed; sign-in OTP disabled (/sign-in/email-otp 404, type sign-in -> INVALID_OTP_TYPE). better-auth emailOTP default send limit 3/60 s.
- Email on => requireEmailVerification, sendOnSignIn, autoSignInAfterVerification.
- Passwords 12-128. Sessions: expiresIn 7 d, updateAge unset => better-auth default 1 d (1440*60), freshAge 7 d. Re-auth window 15 min on /link-social, /unlink-account, passkey register/delete (SESSION_NOT_FRESH).
- Trusted device 30 d. Passkey rpID = hostname(CORS_ORIGIN), origin = CORS_ORIGIN.
- Rate limits (storage database, off when NODE_ENV=test): default 100/60 s; sign-in/email 10/60; sign-in/social 10/60; sign-up/email 5/300; passkey auth 20/60; 2FA totp 10/300; backup code 5/300; plus ACCOUNT_EXISTS 20/60, AI chat 30/300.
- TRUSTED_PROXIES -> advanced.ipAddress.trustedProxies; IPv4-mapped IPv6 rejected with "write an IPv4-mapped address in its IPv4 form, e.g. 10.0.0.0/24".
- Providers: Google/Apple need ID+SECRET; OIDC needs DISCOVERY_URL+CLIENT_ID, secret optional, scopes openid,email,profile + OIDC_SCOPES, requireIdTokenVerification. Apple adds trusted origin https://appleid.apple.com.
- Callbacks (better-auth 1.7.1, basePath /api/auth): /api/auth/callback/{google,apple,oidc}. Generic OAuth now uses core /callback/:id (generic-oauth/index.mjs:66), NOT /oauth2/callback.
- Linking: enabled, allowDifferentEmails false, allowUnlinkingAll false; implicit link needs provider emailVerified AND local user emailVerified (requireLocalEmailVerified default true, link-account.mjs:83).
- Leaked password: haveIBeenPwned plugin when AUTH_PASSWORD_BREACH_CHECK (default true). Errors "Failed to check password. Please try again later." / "Failed to check password. Status: <n>".
- Setup finish: process.exit(0) after 250 ms when settings changed; relies on restart: unless-stopped.

## Executed (throwaway project audit-backup, postgres:18, 12 migrations)

Backup (works): docker compose exec -T postgres pg_dump -U postgres -d freenary -Fc > freenary.dump Restore in place (works, rc 0): docker compose exec -T postgres pg_restore -U postgres -d freenary --clean --if-exists --no-owner < freenary.dump Restore into empty DB on fresh volume (works, rc 0): docker compose exec -T postgres pg_restore -U postgres -d freenary --no-owner < freenary.dump Plain SQL variant (works, citext recreated): pg_dump ... > freenary.sql ; psql -U postgres -d freenary -v ON_ERROR_STOP=1 -q < freenary.sql Not executed: docs' exact dropdb --force / createdb sequence (equivalent to the fresh-DB case).

## Observed failures (exact)

- Compose, empty .env: "required variable POSTGRES_PASSWORD is missing a value: Set POSTGRES_PASSWORD in .env" (also BETTER_AUTH_SECRET).
- Compose, no .env file at all (vars exported): "env file <dir>/.env not found: stat ...: no such file or directory" — root compose env_file is required.
- POSTGRES_PASSWORD changed after first init: migrate "Error: P1000: Authentication failed against database server..."; up prints 'service "migrate" didn't complete successfully: exit 1'.
- Unreachable DB in migrate: "Please make sure your database server is running at `host:port`."
- Bad env (image): "❌ Invalid environment variables: [... path: [ "TRUSTED_PROXIES", 0 ], message: "Invalid input" ...]", "error: Invalid environment variables", container "Restarting (1)". Short secret: "Too small: expected string to have >=32 characters". Bad bool: 'Invalid option: expected one of "true"|"1"|...'.
- Half email env (image): "error: EMAIL_PROVIDER=resend requires RESEND_API_KEY to be set." restart loop.
- Production boot with DB readable by migrate? no — server boot DB unreadable: "error: The instance configuration could not be read: PrismaClientKnownRequestError ..." (dev only warns "... The environment alone is in force.").
- Secret rotated: "WARN (#1): The stored value of EMAIL_PROVIDER does not open with the current BETTER_AUTH_SECRET." value dropped, server boots.
- Healthy boot: "Server is running on <BETTER_AUTH_URL>", "This instance has no operator yet. The first account to sign in at <CORS_ORIGIN> becomes the operator."
- Web proxy: 502 body "Bad Gateway", log "The API server at <target> did not answer: <reason>", timeout 9 s; 499 when caller left.
- Stored config invalid: setup shows "The stored configuration did not load: {detail}" (InstanceSettingsRejected "The instance configuration does not validate: ...").

## Doc gaps found

1. run/sign-in: linking needs local address confirmed; on instance without email, local emailVerified stays false, so Google/Apple/OIDC sign-in with a password account's address fails (account not linked). Not stated.
2. run/troubleshooting "won't start" table lacks "The instance configuration could not be read" (prod server cannot reach DB at boot) and the no-.env-file compose error.
3. Everything else checked in run/{email,sign-in,updates-and-backups,troubleshooting} matched code/run.
