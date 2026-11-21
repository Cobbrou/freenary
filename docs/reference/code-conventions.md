---
title: Code conventions
description: The lint, format, architecture, message and commit rules the checks enforce.
---

This page lists the rules the repository's configuration files enforce on the code, and where each rule is set. To run the checks, see [Run the checks](../how-to/contribute/run-checks.md).

## Tool versions

| Tool       | Version        | Declared in                         |
| ---------- | -------------- | ----------------------------------- |
| Bun        | `1.4.2`        | `packageManager` in `package.json`  |
| TypeScript | `^6.0.3`       | workspace catalog in `package.json` |
| Ultracite  | `7.10.6`       | `devDependencies` in `package.json` |
| Oxlint     | `1.85.0`       | `devDependencies` in `package.json` |
| Oxfmt      | `0.65.0`       | `devDependencies` in `package.json` |
| oxslop     | `^0.1.1`       | `devDependencies` in `package.json` |
| Lefthook   | `2.1.10`       | `devDependencies` in `package.json` |
| Effect     | `4.0.0-rc.115` | workspace catalog in `package.json` |
| Zod        | `^4.4.3`       | workspace catalog in `package.json` |

Effect is a dependency of the root, `packages/api`, `packages/auth`, `packages/email`, `packages/instance-config` and `apps/web`.

## Lint: `oxlint.config.ts`

- Extends the Ultracite presets `ultracite/oxlint/core`, `ultracite/oxlint/react` and `ultracite/oxlint/tanstack`.
- Extends `oxslop({ strict: true })` from `oxslop/config`, which turns on every oxslop rule as an error. Two rules take options:
  - `oxslop/no-comments` with `allowJsdoc: false`.
  - `oxslop/no-reexport-only-modules` with `allowFiles: ["index.ts"]`.
- Loads the JavaScript plugin `@shadcn/lint`, with `^@/shared/ui(/|$)` as the component import pattern.
- Ignores `packages/ui/**`, `apps/web/src/paraglide/**` and the agent folders (`.claude`, `.cursor`, `.agents` and others).
- In `apps/web/**`, `no-restricted-imports` refuses `@freenary/api` imports except `import type` and these modules: `assistant/prompt`, `assistant/tools`, `assistant/turn`, `assistant/ui`, `dashboards/widgets`, `lib/aggregation`, `lib/budget-profile`, `lib/categories`, `lib/money`, `lib/taxonomy`, `lib/transaction-filters`. The message is: "The web runs this code in the browser: import only the isomorphic @freenary/api modules, or `import type` anything else."
- In `**/*.test.ts` and `**/*.test.tsx`, `oxslop/require-safety-comment-for-type-assertion` is off.

`apps/fumadocs/.oxlintrc.json` is a separate config. It extends `oxslop/presets/all.json` with the same two rule options.

### oxslop rules that change how code is written

| Rule | What it refuses |
| --- | --- |
| `oxslop/no-comments` | Every comment except a `SAFETY:` comment, a tooling directive (`oxlint-`, `eslint-`, `biome-`, `prettier-`, `@ts-`, `c8 `, `v8 `, `istanbul `, `#region`, `#endregion`), a `///` reference, a shebang, a `/*! */` banner and a `/* @__PURE__ */` annotation. JSDoc is refused too (`allowJsdoc: false`). |
| `oxslop/require-safety-comment-for-type-assertion` | A non-`const` type assertion without a `SAFETY:` comment. |
| `oxslop/no-try-catch` | `try`/`catch`. Its message points to `Effect.try` or `Effect.tryPromise`. |
| `oxslop/no-switch` | `switch`. Its message points to `Match`. |
| `oxslop/no-silent-error-swallow` | A catch handler that discards the error and returns `Effect.void`. |
| `oxslop/no-vague-identifiers` | Placeholder names such as `data`, `temp`, `result` or `obj` on local bindings. |
| `oxslop/no-array-filter-map` | Adjacent `filter` and `map` passes. Its message points to one `flatMap` or iterator helpers. |
| `oxslop/no-reexport-only-modules` | A module that only re-exports, except a file named `index.ts`. |
| `oxslop/no-module-mocking` | `vi.mock`, `jest.mock` and `mock.module`. |
| `oxslop/no-emoji` | Emoji in code, strings and comments. |

The full list is in `node_modules/oxslop/presets/all.json`.

## Format: `oxfmt.config.ts`

Spreads the `ultracite/oxfmt` config and adds the agent folders to its `ignorePatterns`. `bun run check` (`ultracite check`) runs Oxlint and Oxfmt in check mode; `bun run fix` (`ultracite fix`) writes the fixes.

## Architecture: Feature-Sliced Design

`apps/web` and `apps/fumadocs` each have a `steiger.config.ts` that applies `fsd.configs.recommended` from `@feature-sliced/steiger-plugin`. Their `lint:fsd` script runs `steiger src --fail-on-warnings`; `bun run check:fsd` runs both through Turbo.

| App | Layers in `src/` |
| --- | --- |
| `apps/web` | `app`, `pages`, `widgets`, `features`, `entities`, `shared` |
| `apps/fumadocs` | `app`, `pages`, `shared` |

`apps/web/src` also holds generated and framework files outside the layers: `routeTree.gen.ts`, `paraglide/` and `server.ts`. `apps/fumadocs/src` holds `routeTree.gen.ts`.

## Path aliases

| Project         | Alias            | Resolves to               |
| --------------- | ---------------- | ------------------------- |
| `apps/web`      | `@/*`            | `./src/*`                 |
| `apps/web`      | `@freenary/ui/*` | `../../packages/ui/src/*` |
| `apps/fumadocs` | `@/*`            | `./src/*`                 |
| `apps/server`   | `@/*`            | `./src/*`                 |
| `packages/ui`   | `@freenary/ui/*` | `./src/*`                 |

The workspace packages are `@freenary/api`, `@freenary/auth`, `@freenary/config`, `@freenary/db`, `@freenary/email`, `@freenary/env`, `@freenary/instance-config` and `@freenary/ui`.

## Effect usage

Code imports Effect modules by name from `"effect"`. The workspaces that import it are `packages/api`, `apps/web`, `packages/instance-config`, `scripts`, `packages/email`, `packages/auth` and `apps/server` (`src/index.ts`, which does not list `effect` in its `package.json`). `apps/fumadocs`, `packages/config`, `packages/db`, `packages/env` and `packages/ui` never import it.

The modules in use are `Effect`, `Data`, `Option`, `Match`, `Result`, `Schema`, `Schedule`, `Predicate`, `Duration`, `Array`, `Record`, `Cause` and `pipe`.

| API | Use in the code | Example |
| --- | --- | --- |
| `Data.TaggedError` | Every error class; no class extends `Error`. Some override `message`, as a field or as a getter built with `Match`. | `packages/api/src/providers/powens/client.ts` (`PowensRequestFailed`), `packages/api/src/providers/types.ts` (`BankInstitutionsUnavailable`) |
| `Effect.tryPromise` | Wraps a promise, with `catch` mapping the cause to a tagged error. | `apps/web/src/app/api/get-viewer.ts` |
| `Effect.runPromise` | Runs an effect where a promise is expected: oRPC handlers, the `BankingProvider` methods, TanStack Start server functions, a route's `beforeLoad`, scripts. | `packages/api/src/providers/mock/index.ts`, `apps/server/src/index.ts` |
| `Match.value` with `Match.discriminatorsExhaustive` | Branches on a `kind` field, in place of `switch`. | `packages/instance-config/src/probe.ts` |
| `Effect.catchTag` | Recovers from one tagged error. | `apps/web/src/pages/callback/api/exchange-callback.ts` |
| `Effect.fn("<area>.<operation>")` with a generator | Named effect functions, in `packages/api` (providers, probes, `instance/release.ts`), `packages/instance-config` and `packages/email`. | `packages/api/src/providers/powens/probe.ts` (`"powens.probe"`) |
| `Effect.mapError` | Turns one error into another. | `packages/api/src/providers/powens/index.ts` |
| `Option.liftThrowable` | Turns a throwing function, such as `JSON.parse` or `getProvider`, into one that returns an `Option`. | `packages/api/src/routers/bank-connection.ts` |
| `Schema.decodeUnknown*` | Decodes the responses of outside HTTP services (Powens, Enable Banking, classifiers, the assistant probe, the release check). Zod covers API inputs, the environment and web search parameters. | `packages/api/src/providers/powens/client.ts` |
| `Effect.result` | Returns success or failure as a `Result` value, read with `Result.isFailure` or `Result.match`. | `packages/api/src/routers/instance.ts` |
| `Effect.retry` and `Effect.repeat` with `Schedule` | Polling and retries. | `apps/web/src/features/instance-integration/api/wait-for-server.ts` |
| `Effect.runFork` | Background work that the caller does not await. | `packages/api/src/routers/budget.ts`, `packages/api/src/instance/release.ts` |

The code has no `Effect.gen`, `Effect.runSync`, `Layer`, `Context` services, `Effect.provide` or `Stream`.

## Data fetching in apps/web

- `apps/web/src/shared/api/orpc.ts` creates the oRPC client, typed by `AppRouter` from `@freenary/api/routers/index`. Its `RPCLink` calls `${getServerUrl()}/rpc` with `credentials: "include"` and `SimpleCsrfProtectionLinkPlugin`, and forwards a `cookie` from the call context when one is given.
- `@/shared/api` exports `client` (the plain client), `orpc` (`createTanstackQueryUtils(client)` from `@orpc/tanstack-query`) and `createQueryClient`.
- `createQueryClient` sets a `staleTime` of 60 seconds. A failed query that a component observes shows a toast (`query_error_generic`) with a retry action (`query_error_retry`). A failed mutation shows a toast (`mutation_error_generic`) unless it has its own `onError` or `meta: { errorShownInline: true }`.
- Components read with `useQuery(orpc.<router>.<procedure>.queryOptions({ input }))` and write with `useMutation`, either from `orpc.<router>.<procedure>.mutationOptions()` or with a `mutationFn` that calls `client`. They invalidate with `queryClient.invalidateQueries({ queryKey: orpc.<router>.key() })`. `useInfiniteQuery` uses `infiniteQueryOptions` over `client.budget.getTransactions`.
- Query options shared across slices sit in `entities/<entity>/api/`: `budget`, `conversation` and `dashboard`.
- Code that checks an error code compares `error instanceof ORPCError && error.code === "<CODE>"`, as in `apps/web/src/pages/settings/model/use-custom-category-form.ts`.
- `apps/web/src/app/router/router.tsx` creates one `QueryClient` per router, passes `{ orpc, queryClient }` as router context, sets `defaultPreloadStaleTime: 0` and calls `setupRouterSsrQueryIntegration`.
- No route has a `loader`. `beforeLoad` serves redirects and checks:
  - `__root.tsx` returns `instance` and `viewer`. On the server it reads them through the server functions `getInstanceSetup` and `getViewer` (`createServerFn` in `apps/web/src/app/api/`), which call `client` with the request's cookie.
  - `login.tsx`, `setup.tsx`, `onboarding.tsx` and `_auth/route.tsx` redirect from those values.
  - `callback/$provider.tsx` (`ssr: false`) exchanges the bank callback through `exchangeCallback`.

## Shared UI

- `packages/ui` (`@freenary/ui`) holds the shared primitives: `src/components/` (the components, and `charts/` with the `legend`, `patterns`, `sankey` and `tooltip` folders), `src/hooks/`, `src/lib/` and `src/styles/` (`globals.css` and `fonts/`). Its `package.json` `exports` map lists the importable paths, such as `@freenary/ui/components/button` and `@freenary/ui/lib/utils`.
- It builds on `@base-ui/react`, `@remixicon/react`, `class-variance-authority`, `tailwind-merge`, `motion` and `d3-*`.
- Oxlint ignores `packages/ui/**`. Its `check-types` script runs three TypeScript configs: `tsconfig.json`, `tsconfig.test.json` and `tsconfig.strict.json`.
- `apps/web/src/shared/ui` holds the components that belong to the web app, such as `wizard/`, `sankey-chart/` and `theme-switcher.tsx`. The `@shadcn/lint` plugin treats imports matching `^@/shared/ui(/|$)` as component imports.
- The primitives carry English accessible names. `UiLabelsProvider` from `@freenary/ui/lib/labels` overrides them: `apps/web/src/app/__root.tsx` passes `uiLabels()` from `apps/web/src/app/ui-labels.ts`, built from `ui_*` messages. The root also sets `SizeProvider` (`defaultSize="compact"`) and `IconProvider`.

Both `components.json` files (the shadcn CLI configuration) use style `base-mira`, base color `neutral`, CSS variables and icon library `remixicon`:

| File | `components` alias | `ui` alias | Tailwind CSS | Registries |
| --- | --- | --- | --- | --- |
| `packages/ui/components.json` | `@freenary/ui/components` | `@freenary/ui/components` | `src/styles/globals.css` | `@fluid`, `@bklit` |
| `apps/web/components.json` | `@/shared/ui` | `@freenary/ui/components` | `../../packages/ui/src/styles/globals.css` | `@fluid` |

`@fluid` is `https://www.fluidfunctionalism.com/r/{name}.json` and `@bklit` is `https://bklit.com/r/{name}.json`. The root `package.json` also declares `@fluid` under `registries`.

## Interface text

- `apps/web/project.inlang/settings.json`: base locale `en`, locales `en` and `fr`, messages in `./messages/{locale}.json`.
- `apps/web/messages/en.json` and `apps/web/messages/fr.json` hold every message, keyed by snake_case keys such as `setup_variant_mock`. A value takes variables in braces, such as `"Update available: v{version}"`.
- Paraglide compiles the messages into `apps/web/src/paraglide/`, which Git ignores. The locale strategy is `cookie`, then `preferredLanguage`, then `baseLocale`; the cookie is `PARAGLIDE_LOCALE`.
- Components import the messages as `import { m } from "@/paraglide/messages.js";` and call `m.<key>()`. The locale comes from `import { getLocale } from "@/paraglide/runtime.js";`.
- A table of labels stores the message functions themselves and calls them when read, as `FIELD_LABELS` in `apps/web/src/features/instance-integration/model/labels.ts` does (`satisfies Record<string, () => string>`).
- `packages/ui` does not use Paraglide; see [Shared UI](#shared-ui).

## Tests

- The test runner is `bun test`, with `bun:test` imports. There is no root `test` script.
- Test files are named `*.test.ts` or `*.test.tsx` and sit next to the code they test, in `apps/web`, `apps/fumadocs`, `packages/api`, `packages/auth`, `packages/email`, `packages/env`, `packages/instance-config`, `packages/ui` and `scripts`.
- CI runs `bun test` in `packages/api` only.

## Commit hooks

`lefthook.yml` declares one `pre-commit` hook with four jobs run in order: `oxlint` (with `--fix`), `oxfmt` (with `--write`), `env-sync` and `docs-reference`. The last two regenerate files when their sources are staged. Details are in [Run the checks](../how-to/contribute/run-checks.md#the-commit-hooks).
