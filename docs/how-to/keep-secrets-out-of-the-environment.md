---
title: Keep secrets out of the environment
description: Read the database URL, the session secret and other secrets from Docker secret files.
---

This page moves the secrets of the root `docker-compose.yml` stack into files. A variable set through `environment` or `env_file` is part of the container's configuration, so `docker inspect freenary-server-1` prints it to anyone who can reach the Docker socket. A Compose secret is a file mounted under `/run/secrets/` instead, and `docker inspect` shows only its path.

The API server reads any variable of the [Configuration](../reference/configuration.md) reference from a file when `<NAME>_FILE` holds the file's path and `<NAME>` is unset. The `migrate` service reads `DATABASE_URL_FILE` the same way, and the `postgres` image reads `POSTGRES_PASSWORD_FILE`.

## Before you start

- A running stack from the root `docker-compose.yml`, as in [Get it running](../tutorials/get-it-running.md) or [Self-host on a server](../tutorials/self-host-on-a-server.md).

## Steps

1. Write each secret to a file in a `secrets` folder next to `docker-compose.yml`. The database URL repeats the database password:

   ```bash
   mkdir -p secrets && chmod 700 secrets
   PASSWORD=$(openssl rand -hex 16)
   printf '%s' "$PASSWORD" > secrets/postgres_password
   printf 'postgresql://postgres:%s@postgres:5432/freenary' "$PASSWORD" > secrets/database_url
   openssl rand -hex 32 | tr -d '\n' > secrets/better_auth_secret
   chmod 644 secrets/*
   ```

   The server runs as the `bun` user of its image, so each file must be readable by every user. The `secrets` folder keeps other users of the host out. To keep the current database password, write the value of `POSTGRES_PASSWORD` from `.env` instead of a new one: the database volume keeps the password it was created with.

2. Remove `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` from `.env`. A variable set both directly and through `<NAME>_FILE` stops the start.

3. In `docker-compose.yml`, delete the `x-database-url` line, then change the `postgres`, `migrate` and `server` services and add a `secrets` section at the end:

   ```yaml
   services:
     postgres:
       environment:
         POSTGRES_DB: freenary
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
       secrets:
         - postgres_password

     migrate:
       environment:
         DATABASE_URL_FILE: /run/secrets/database_url
       secrets:
         - database_url

     server:
       environment:
         DATABASE_URL_FILE: /run/secrets/database_url
         BETTER_AUTH_SECRET_FILE: /run/secrets/better_auth_secret
         BETTER_AUTH_URL: ${BETTER_AUTH_URL:-http://localhost:3001}
         CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3001}
         NODE_ENV: production
       secrets:
         - database_url
         - better_auth_secret

   secrets:
     postgres_password:
       file: ./secrets/postgres_password
     database_url:
       file: ./secrets/database_url
     better_auth_secret:
       file: ./secrets/better_auth_secret
   ```

   Keep the other keys of each service as they are. Any other secret, such as `SMTP_PASSWORD` or `POWENS_CLIENT_SECRET`, moves the same way: a file, an entry under `secrets`, the service's `secrets` list, and `<NAME>_FILE` in place of the line in `.env`.

4. Restart the stack:

   ```bash
   docker compose up -d
   ```

If you later download a new `docker-compose.yml`, apply these changes to it again.

## Check that it works

```bash
docker inspect freenary-server-1 --format '{{json .Config.Env}}'
```

The output lists `BETTER_AUTH_SECRET_FILE=/run/secrets/better_auth_secret` and `DATABASE_URL_FILE=/run/secrets/database_url`, and neither secret value. Sign in to the web app to confirm the server reads them.

## If something goes wrong

The server prints the problem and exits with status 1. `docker compose logs server` shows it:

- `- BETTER_AUTH_SECRET_FILE: BETTER_AUTH_SECRET is set too. Set only one of them.` → remove `BETTER_AUTH_SECRET` from `.env`.
- `- BETTER_AUTH_SECRET_FILE: /run/secrets/better_auth_secret is not a readable file.` → the service has no `secrets` entry for it, or the source file does not exist.
- `EACCES: permission denied, open '/run/secrets/better_auth_secret'` → the file is not readable by the `bun` user. Run `chmod 644` on it.
- `migrate` exits with `DATABASE_URL_FILE: DATABASE_URL is set too. Set only one.` → its `environment` still sets `DATABASE_URL`.
