---
title: Architecture
description: How the services, apps and packages fit together.
---

This page describes what runs when you start Freenary, how a request travels through it, and how the source code is split. It describes the code as it is; it does not give reasons for the choices.

## The running services

The Compose files ([`docker-compose.yml`](https://github.com/suiramdev/freenary/blob/dev/docker-compose.yml) and [`deploy/docker-compose.yml`](https://github.com/suiramdev/freenary/blob/dev/deploy/docker-compose.yml)) start four services. [Compose files](../reference/compose-files.md) lists their exact settings.

| Service | Image | Role |
| --- | --- | --- |
| `postgres` | `postgres:18` | The only place Freenary keeps data. The data lives in the `freenary_postgres_data` volume. |
| `migrate` | `ghcr.io/suiramdev/freenary-server` | Runs `bun x prisma migrate deploy` once, then exits. `server` starts only after it exits successfully. |
| `server` | `ghcr.io/suiramdev/freenary-server` | The API server, listening on port `3000` inside the Docker network. The Compose files publish no port for it. |
| `web` | `ghcr.io/suiramdev/freenary-web` | The web app on port `3001`. It renders the pages and forwards API requests to `server`. |

Each service waits for the one before it: `migrate` waits for a healthy `postgres`, `server` waits for both, and `web` waits for a healthy `server`. The `server` and `web` healthchecks fetch `/` on their own port.

## One address for the browser

The browser only ever talks to `web`. The web app's request handler ([`apps/web/src/server.ts`](https://github.com/suiramdev/freenary/blob/dev/apps/web/src/server.ts)) checks each request path. Requests under these paths go to the API server at `SERVER_URL` (`http://server:3000` in the Compose files):

- `/api/auth` — sign-in, sign-up and sessions
- `/rpc` — the calls the web app makes for its data
- `/ai/chat` — the assistant
- `/api-reference` — the OpenAPI version of the API and its interactive reference
- `/mcp` — the MCP server that AI agents connect to

Every other path is a page that the web app renders. When it renders a page, the web app's own server also calls the API at `SERVER_URL`.

Because of this forwarding, `BETTER_AUTH_URL` (the API's public address) and `CORS_ORIGIN` (the web app's public address) hold the same value in the default setup. The forwarder replaces the caller's `X-Forwarded-For` header with the address of the connection. When that connection comes from an address listed in `TRUSTED_PROXIES`, it uses the caller address that the proxy reported instead. When every address it was given is in `TRUSTED_PROXIES`, it keeps the address of the connection, which a caller cannot forge. It gives up after 9 seconds and answers `502 Bad Gateway`.

```text
browser ──► [reverse proxy, optional] ──► web :3001 ──► server :3000 ──► postgres :5432
                                             │                │
                                             └ renders pages  ├► bank provider (Powens or Enable Banking)
                                                              ├► email provider (Resend or SMTP), optional
                                                              ├► assistant model, optional
                                                              └► transaction classifier, optional
```

## The API server

The API server ([`apps/server/src/index.ts`](https://github.com/suiramdev/freenary/blob/dev/apps/server/src/index.ts)) is an [Elysia](https://elysiajs.com/) app running on [Bun](https://bun.sh/). It serves:

- **`/api/auth/*`** through [better-auth](https://www.better-auth.com/), which handles accounts, sessions, passkeys, two-factor codes and the optional Google, Apple and OIDC sign-in.
- **`/rpc/*`** and **`/api-reference/*`**: the same procedures through two [oRPC](https://orpc.unnoq.com/) handlers. `/rpc` uses oRPC's own protocol and a CSRF check. `/api-reference` is the OpenAPI version. [API](../reference/api.md) lists every procedure.
- **`POST /ai/chat`**: the assistant.
- **`POST /mcp`**: the [MCP server](../reference/mcp-server.md), which gives AI agents the assistant's tools. It answers only an API key.
- **`GET /`**: answers `OK`, for healthchecks.

At startup it checks its environment against the schema in `packages/env/src/schema.ts` and stops if a value is wrong, then reads settings saved from the app (see [Where settings come from](settings-sources.md)). It also checks for a newer release, as described in [Update notice](#update-notice).

### Update notice

The server asks GitHub for the newest Freenary release once at start and then every 24 hours. When it is newer than the running version, the operator sees **Freenary v1.2.0 is available** at the top of every page, with **Release notes** and **How to update**, and **Update available: v1.2.0** in the account menu. Other members see nothing. The close button, **Dismiss the notice for v1.2.0**, hides the notice in that browser until a newer release comes out.

The check needs a server image built from a release, which knows its version through `FREENARY_BUILD_VERSION`. Images tagged `main`, `dev` or `sha-…` show no notice. `FREENARY_UPDATE_CHECK=false` turns the check off, and the server then sends no request to GitHub.

## The web app

The web app (`apps/web`) is a [TanStack Start](https://tanstack.com/start) app built with Vite and served by Bun. It ships in English and French. It learns the browser-facing API address at request time from `PUBLIC_SERVER_URL`, so one image works at any address.

## The source code

The repository is a Bun workspace managed with Turborepo.

| Folder | Package | Contents |
| --- | --- | --- |
| `apps/server` | `server` | The API server entry point. |
| `apps/web` | `web` | The web app. |
| `apps/fumadocs` | `fumadocs` | The documentation site. It renders the `docs/` folder. |
| `packages/api` | `@freenary/api` | The oRPC routers, bank providers (`powens`, `enable-banking`, `mock`), categorisation and the assistant. |
| `packages/auth` | `@freenary/auth` | The better-auth setup. |
| `packages/db` | `@freenary/db` | The Prisma schema (`prisma/schema/*.prisma`), migrations and client. |
| `packages/email` | `@freenary/email` | The Resend and SMTP email adapters. |
| `packages/env` | `@freenary/env` | The environment schemas for the server and the web app. |
| `packages/instance-config` | `@freenary/instance-config` | Settings saved from the app, the first-run claim, and the list of integrations the setup screen shows. |
| `packages/ui` | `@freenary/ui` | Shared React components. |
| `packages/config` | `@freenary/config` | The shared TypeScript base configuration. |

The dependencies point one way: `apps/server` uses `api`, `auth`, `db`, `env` and `instance-config`. `api` uses `auth`, `db`, `email`, `env` and `instance-config`. `apps/web` uses `api` (for types and shared constants), `env` and `ui`.

## Related

- [First run and the operator](first-run-and-operator.md)
- [Where settings come from](settings-sources.md)
- [How transactions get categories](categorisation.md)
- [Container images](../reference/images.md)
