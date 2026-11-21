---
title: Update Freenary
description: Move your instance to a newer release, or pin a version.
---

This page moves a running instance to a newer version of Freenary, pins it to one version, or takes it back to an older one. The version is the tag of the two published images, `ghcr.io/suiramdev/freenary-server` and `ghcr.io/suiramdev/freenary-web`, and `FREENARY_VERSION` in `.env` picks it for both.

## Before you start

- Freenary runs with `docker-compose.yml` or `deploy/docker-compose.yml`, and you are in the folder that holds it and `.env`.
- You have a fresh backup of the database and a copy of `.env`. An update can change the database schema, and only a backup takes it back. See [Back up and restore](back-up-and-restore.md).
- You know which version you want. The [releases page](https://github.com/suiramdev/freenary/releases) lists them, with their notes. [Container images](../reference/images.md#tags) lists every tag and what it follows: `latest`, the default, follows the newest release.

## Steps

### Update or pin a version

1. Set the version in `.env`. To pin a release:

   ```dotenv
   FREENARY_VERSION=0.1.0
   ```

   To follow the newest release, set `FREENARY_VERSION=latest` or remove the line.

2. Download the images of that version:

   ```bash
   docker compose pull
   ```

3. Recreate the containers on the new images:

   ```bash
   docker compose up -d
   ```

   Compose first runs the `migrate` service, which applies the database migrations the new version brings, then starts `server` once `migrate` has exited without error, then `web` once `server` is healthy.

### Go back to an older version

The `migrate` service only moves the schema forward. With an older image, it finds no migration to apply and prints `No pending migrations to apply.`, and the older server runs against the newer schema. To go back, restore the backup you took before the update:

1. Put the `.env` from the backup in place:

   ```bash
   cp freenary.env .env
   ```

2. Set `FREENARY_VERSION` in `.env` to the version you wrote down when you made the backup, for example `FREENARY_VERSION=0.1.0`. Without it, Compose uses `latest`, the newer image, and its `migrate` service moves the restored database forward again.
3. Download that version:

   ```bash
   docker compose pull
   ```

4. Restore the database: follow steps 2 to 4 of [Restore a backup](back-up-and-restore.md#restore-a-backup). Skip its step 1, which you just did.

## Check that it works

1. Check which image each container runs:

   ```bash
   docker compose ps --format '{{.Service}} {{.Image}} {{.Status}}'
   ```

   `server` and `web` show the new tag and `(healthy)`, for example `server ghcr.io/suiramdev/freenary-server:0.1.0 Up 5 seconds (healthy)`.

2. Read what `migrate` did:

   ```bash
   docker compose logs migrate
   ```

   It ends with `All migrations have been successfully applied.` when the new version changed the schema, or `No pending migrations to apply.` when it did not.

## If something goes wrong

- `docker compose pull` fails with `manifest for ghcr.io/suiramdev/freenary-server:… not found: manifest unknown`. No image has that tag. Check `FREENARY_VERSION` against the releases page.
- `docker compose up -d` stops with `service "migrate" didn't complete successfully: exit 1`. A migration failed. Read `docker compose logs migrate`, then restore your backup with the version you ran before.
- `docker compose up -d` stops with `dependency failed to start: container …-server-1 is unhealthy` or `… exited (1)`. Read `docker compose logs server`. See [Troubleshoot](troubleshoot.md).
- The server logs `[update-check] The Freenary releases could not be read, and the check runs again in 24 hours: …`. The server could not reach GitHub. Freenary works as before. Set `FREENARY_UPDATE_CHECK=false` to stop the check.

## Related

- [Update notice](../explanation/architecture.md#update-notice)
- [Images](../reference/images.md)
- [Configuration](../reference/configuration.md#core-and-secrets)
- [Back up and restore](back-up-and-restore.md)
