# `packages/env` — Environment Variables

Type-safe environment variable validation using `@t3-oss/env-core` + Zod.

## Layout

```
src/
  schema.ts         # The server shape: every server variable, its description and its metadata
  server.ts         # Hands that shape to createEnv: import { env } from "@freenary/env/server"
  schema-web.ts     # The client shape: the VITE_ variables
  web.ts            # Hands that shape to createEnv with clientPrefix: "VITE_"
```

## Conventions

- **Server vars** are declared in `src/schema.ts`. `src/server.ts` only hands that object to `createEnv`, so no variable is declared there. They are validated at startup and available via `import { env } from "@freenary/env/server"`.
- **Client vars** are declared in `src/schema-web.ts`, which `src/web.ts` hands to `createEnv` with `clientPrefix: "VITE_"`. Available via `import { env } from "@freenary/env/web"`. The client shape is a separate module because `src/schema.ts` reads `process.env` at module scope, and Vite bundles the client schema into the browser.
- `src/schema.ts` also carries the `zod/v4/core` `GlobalMeta` augmentation that types the metadata: `section`, `example`, `onError`, `default`, `envFile`, `productionRequired` and `secret`.
- Every env var must have a Zod schema. Use `.min(1)` for required strings, `.url()` for URLs, `.default(...)` for optional values.
- **`devDefault(schema, value)` drops the default when `NODE_ENV` is `production`.** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN` and `DATABASE_URL` therefore carry a development value and are required in production: a production start with any of the four unset stops with the invalid-environment report.
- `skipValidation` is controlled by `SKIP_ENV_VALIDATION` — useful for build steps that don't need runtime env.
- **When adding a new variable: declare it once in `src/schema.ts`** with `.describe()` and `.meta({ section, example, onError })`, then run `bun run env:sync` from the repository root. That writes the root `.env.example` and the tables of `apps/fumadocs/content/docs/next/reference/configuration.mdx`. Neither artifact is edited by hand, and no compose file needs an edit: `docker-compose.dev.yml` and `docker-compose.yml` both give the `server` service every line of the root `.env` through `env_file`, and `environment` there carries only what the stack derives or refuses to start without. `environment` wins over `env_file`.
- **`bun run env:check` is the same script with `--check`**, and it is the `Environment` step of CI. A lefthook pre-commit job runs `env:sync` when `src/schema*.ts`, a `docker-compose*.yml` or `scripts/env-sync.ts` is staged, and stages what it writes. The gate fails on four mistakes: a schema key with no `.describe()`, no `example` or no `onError`; a `process.env.X` read under `apps/`, `packages/` or `scripts/` that no schema and no allow-list declares; a `${VAR}` in a compose file that nothing declares; and an allow-list entry no file uses. A stale `.env.example` or configuration reference fails it too.
- **The allow-list lives in `scripts/env-sync.ts`** as `EXTERNAL`. It holds the variables that stay outside the schema, each with the reason it does and who reads it, and the generator prints them in their own tables.
- `PUBLIC_SERVER_URL` and `SERVER_URL` are the exception: `apps/web/src/shared/config/server-url.ts` reads them raw from `process.env` at request time, outside any schema here. They are declared in the `scripts/env-sync.ts` allow-list, not undeclared.
