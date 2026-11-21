---
title: Container images
description: The published images, their tags and what each tag tracks.
---

Freenary publishes two container images to the GitHub Container Registry. The `Images` workflow (`.github/workflows/images.yml`) builds them from `apps/server/Dockerfile` and `apps/web/Dockerfile`.

## Images

| Image | Built from | Listens on | Command |
| --- | --- | --- | --- |
| `ghcr.io/suiramdev/freenary-server` | `apps/server/Dockerfile` | `3000` | `bun dist/index.mjs` in `/app/apps/server` |
| `ghcr.io/suiramdev/freenary-web` | `apps/web/Dockerfile` | `3001` | `bun .output/server/index.mjs` in `/app/apps/web` |

The image name is `ghcr.io/<repository, lower case>-<app>`, so a fork that runs the workflow publishes under its own name. Both images use the base image `oven/bun:1.4.2`. The server image also runs the database migrations: the `migrate` service of `docker-compose.yml` runs `bun x prisma migrate deploy` in `/app/packages/db` of the server image.

## Tags

| Tag | Trigger | Points at |
| --- | --- | --- |
| `latest` | the `Release` workflow, stable version | the stable release published last |
| `X.Y.Z` | the `Release` workflow | that release; a prerelease gets only `X.Y.Z-<pre>` |
| `X.Y` | the `Release` workflow, stable version | the `X.Y.*` stable release published last |
| `X` | the `Release` workflow, stable version | the `X.*.*` stable release published last |
| `main` | a push to `main` | the head of `main` |
| `dev` | a push to `dev` | the head of `dev` |
| `sha-<7 characters>` | a push to `dev` or `main` | that commit |

A push to `dev` or `main` builds nothing when every changed file is under `apps/fumadocs/`, under `docs/`, or a `.md` file. `docker-compose.yml` uses `${FREENARY_VERSION:-latest}` as the tag of both images.

## Platforms

Every tag is a multi-platform manifest for `linux/amd64` and `linux/arm64`. Each platform builds on its own native runner (`ubuntu-latest` and `ubuntu-24.04-arm`), then one manifest joins the two digests. For example, `docker manifest inspect ghcr.io/suiramdev/freenary-server:0.1.0` lists:

```text
"architecture": "amd64", "os": "linux"
"architecture": "arm64", "os": "linux"
```

The manifest also holds two entries with `"architecture": "unknown"` and `"os": "unknown"`. The same two platforms show for `freenary-server` tags `latest`, `0.1` and `0`, and for `freenary-web` tags `latest`, `main` and `dev`.

## Build arguments

| Argument | Image | Default | Effect |
| --- | --- | --- | --- |
| `FREENARY_VERSION` | server | empty | Sets `FREENARY_BUILD_VERSION` in the running container. The update check compares it with the newest release. |
| `GITHUB_REPOSITORY` | server | `suiramdev/freenary` | The repository whose newest `data-*` GitHub release holds the merchant data the build downloads. |

The workflow passes the version derived from the trigger as `FREENARY_VERSION` (`X.Y.Z`, `X.Y.Z-<pre>`, `main` or `dev`) and its own repository as `GITHUB_REPOSITORY` to both builds. The web Dockerfile declares neither, so the web build ignores them.

## Build secret

The server build reads an optional BuildKit secret with the id `GITHUB_TOKEN`, mounted at `/run/secrets/GITHUB_TOKEN`. It lifts the GitHub API rate limit of the merchant data download and is not stored in the image. Without it the download runs without a token. If the download fails, the build runs `bun run build:data:generate` in `packages/api` instead.

## Environment set by the images

| Variable | Server | Web |
| --- | --- | --- |
| `NODE_ENV` | `production` | `production` |
| `FREENARY_BUILD_VERSION` | the `FREENARY_VERSION` build argument | not set |
| `HOST` | not set | `0.0.0.0` |
| `PORT` | not set (the server defaults to `3000`) | `3001` |

Every other setting comes from the container environment at run time. See [Configuration](configuration.md) and [Compose files](compose-files.md).

## Related

- [Build the images from source](../how-to/build-images-from-source.md)
- [Release a version](../how-to/contribute/release-a-version.md)
- [Update Freenary](../how-to/update-freenary.md)
