---
title: Build the images from source
description: Run Freenary from images you build yourself instead of the published ones.
---

This page helps you build the `server` and `web` images from a clone of the repository, and run the stack of `docker-compose.yml` with them instead of the published `ghcr.io/suiramdev/freenary-*` images.

## Before you start

- Git, and Docker with Compose and BuildKit (the default builder of current Docker versions).
- About 1 GB of free disk space for the two images. Each one is about 500 MB.
- Network access during the build: it installs the dependencies, and the server build downloads the merchant data from the newest `data-*` release of the repository.

## Steps

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/suiramdev/freenary.git ~/freenary
   cd ~/freenary
   ```

   To build a release instead of the development branch, check out its tag, such as `git checkout v0.1.0`.

2. Build the server image. The build context is the root of the clone:

   ```bash
   docker build -f apps/server/Dockerfile -t freenary-server:local .
   ```

   Optional: pass a GitHub token as a build secret to lift the API rate limit of the merchant data download. The token does not end up in the image:

   ```bash
   GITHUB_TOKEN=<your token> docker build -f apps/server/Dockerfile --secret id=GITHUB_TOKEN -t freenary-server:local .
   ```

3. Build the web image:

   ```bash
   docker build -f apps/web/Dockerfile -t freenary-web:local .
   ```

   Optional: add `--build-arg FREENARY_VERSION=0.1.0` to the server build. The server uses it for the update check. See [Container images](../reference/images.md#build-arguments).

4. To run the stack with your own builds, open `docker-compose.yml` and replace the `image:` line of the `migrate`, `server` and `web` services with a `build:` line, as the comment at the top of the file says. Keep `postgres` as it is:

   ```yaml
   migrate:
     build: { context: ., dockerfile: apps/server/Dockerfile }
   server:
     build: { context: ., dockerfile: apps/server/Dockerfile }
   web:
     build: { context: ., dockerfile: apps/web/Dockerfile }
   ```

   Compose then builds the images itself, so steps 2 and 3 are only needed to build an image on its own.

5. Create the `.env` file with a database password and a secret:

   ```bash
   cp .env.example .env
   sed -i.bak "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/; s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" .env && rm .env.bak
   ```

   See [Core and secrets](../reference/configuration.md#core-and-secrets) for the other values.

6. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

## Check that it works

Each build ends with the export of the image. The web build of step 3 ended with:

```text
#12 DONE 31.0s
```

and the server build printed, during its data step:

```text
Using merchant data from release data-2026-11-16
```

`docker image ls freenary-web:local` then lists the image. Once the stack runs, the web app answers on port `3001`:

```bash
curl http://localhost:3001/api/auth/ok
```

```text
{"ok":true}
```

> **TODO (unverified):** the full stack started from `build:` services. The build of all three services succeeded, but the test machine ran out of disk space before the `web` container started.

## If something goes wrong

- `required variable POSTGRES_PASSWORD is missing a value: Set POSTGRES_PASSWORD in .env` (or `BETTER_AUTH_SECRET`) → step 5 left a value empty. Fill it in `.env`.
- `failed to stat GITHUB_TOKEN: stat GITHUB_TOKEN: no such file or directory` → you passed `--secret id=GITHUB_TOKEN` and the `GITHUB_TOKEN` variable is not set in your shell. Set it, or drop the `--secret` flag.
- `NoSpaceLeft` in the `bun install` step of the build → Docker has run out of disk space. Free space, for example with `docker image prune`, and build again.
- To go back to the published images, restore the file with `git checkout docker-compose.yml` and run `docker compose up -d`.

## Related

- [Container images](../reference/images.md)
- [Compose files](../reference/compose-files.md)
- [Update Freenary](update-freenary.md)
