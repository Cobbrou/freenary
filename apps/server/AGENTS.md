# `apps/server`

## Stack

- **Elysia** HTTP framework on **Bun** (`bun run --hot src/index.ts`, port 3000).
- **oRPC** — typed RPC handler at `/rpc*`, OpenAPI reference at `/api-reference*`.
- **AI SDK** — the assistant's token stream at `POST /ai/chat`, handled by `@freenary/api/assistant/handler`.
- **Better Auth** — session/auth handler at `/api/auth/*`, configured in `packages/auth`.
- **evlog** — structured logging via Elysia plugin; file-system drain in dev.
- **tsdown** for production builds (`bun run build`).

## Layout

```
src/
  index.ts        # Elysia app: CORS, auth, RPC, OpenAPI, assistant stream, health check
```

The server is thin glue — business logic lives in `packages/api`, auth in `packages/auth`, database in `packages/db`. This app wires them together and exposes HTTP endpoints.

## Conventions

- All API procedures belong in `packages/api/src/routers/`, not here. This app mounts the router — it does not define procedures.
- Environment variables are declared in `packages/env/src/schema.ts` and validated at startup by `@freenary/env/server`, which hands that shape to `createEnv`. Add a new server-side variable there, not in this app, then run `bun run env:sync` from the repository root to regenerate `.env.example` and the configuration reference.
- `@freenary/env/server` imports `dotenv/config`, so an optional, gitignored `apps/server/.env` supplies local defaults when this app runs from its own directory. The Docker stacks supply them instead: the root `.env` reaches the container through `env_file`, and `docker-compose.dev.yml` sets `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `AUTH_COOKIE_DOMAIN` and `NODE_ENV` under `environment`, which wins over both `env_file` and anything dotenv would load.
- CORS is restricted to `env.CORS_ORIGIN`; credentials are enabled.

## Adding a new HTTP surface

1. Define an oRPC procedure in `packages/api/src/routers/`.
2. The existing RPC handler in `src/index.ts` picks it up automatically.
3. For non-oRPC endpoints (webhooks, static files), add an Elysia route in `src/index.ts`. Add its path prefix to `FORWARDED_PATH_PREFIXES` in `apps/web/src/shared/lib/forward-api-request.ts` too, or a single-origin deployment answers it with the web app's 404; `bun test scripts/deploy-templates.test.ts` catches the omission, but CI runs only the `packages/api` tests, so run it by hand.

A streaming route needs `{ parse: "none" }` like `/rpc*`, or Elysia consumes the body before the handler reads it. `/ai/chat` is the only such route today; its handler lives in `packages/api/src/assistant/` and returns a `Response`, so this app stays glue.
