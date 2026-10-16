# Working in this repository

**Read [`CONTEXT.md`](CONTEXT.md) first** — the glossary and the settled definition of each term.

The rest of this file covers how to get a working stack, what every change owes the docs and the message catalogs, how to write the pull request, and the code-quality standard.

**Contributing:** follow [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). When opening or drafting a pull request, use every section of [`.github/pull_request_template.md`](.github/pull_request_template.md) — Summary, Motivation, Drawbacks, Prior art, Notes — and keep each one short.

## Getting a Working Stack

```bash
bun install
bun run dev:up     # PostgreSQL, migrations, API server, web app, docs site
```

`dev:up` runs `docker-compose.dev.yml` under a per-worktree Compose project and prints the URLs it serves. No dev service publishes a host port: one shared Traefik on port 80 routes plain-HTTP hostnames (`web.<slug>.freenary.localhost`, `server.<slug>.freenary.localhost`, `docs.<slug>.freenary.localhost`) to the containers, and the slug comes from the git branch. `scripts/dev.ts` reuses a Traefik already on the `devproxy` network, or starts `docker-compose.proxy.yml`; the self-hosting `docker-compose.yml` never involves it. Use Chrome or Firefox, which treat `*.localhost` as a secure context. Without Docker for the apps, use the local path instead:

```bash
bun run db:start   # PostgreSQL container from docker-compose.yml (needs the root .env: cp .env.example .env)
bun run db:push    # apply the Prisma schema
bun run dev        # web 3001, server 3000, docs 4000
```

The dev stack needs no `.env`: the `server` service declares `env_file` with `required: false`, so an optional root `.env` reaches the container line by line, and `environment` carries only the six values the stack derives from the worktree — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `AUTH_COOKIE_DOMAIN` and `NODE_ENV` (Compose gives `environment` precedence over `env_file`). It configures no email provider, so the one-time-code flows are off. `bun run dev:mail` layers `docker-compose.mail.yml` over it: that file starts `axllent/mailpit:v1.28` and points the server at it with `EMAIL_PROVIDER=smtp`, `SMTP_HOST=freenary-mailpit`, `SMTP_PORT=1025` and `EMAIL_FROM=Freenary <no-reply@freenary.test>`, and the inbox is a web page at `http://mail.<slug>.freenary.localhost`. `bun run dev:reset` destroys the volumes and starts over. The `bootstrap` service runs `prisma migrate deploy` before the API server starts.

**There is no seed script.** Create an account through the sign-in screen. Neither `bun run dev:up` nor `bun run dev` configures an email provider, so `requireEmailVerification` stays off, sign-up returns a session at once, and the interface shows no **Forgot password?** link. To work on the one-time-code flows, start the stack with `bun run dev:mail` and read the code in the Mailpit inbox. Bank data needs real bank-provider credentials (`BANKING_PROVIDER`, `POWENS_*` or `ENABLE_BANKING_*`); with none, the bank list reports that bank linking is unavailable and onboarding skips the connect step.

The production stack is `docker-compose.yml` (`bun run docker:up`, which is `docker compose up -d`). It runs the published `ghcr.io/suiramdev/freenary-server` and `ghcr.io/suiramdev/freenary-web` images, and applies the migrations itself through its one-shot `migrate` service. Its root `.env` carries `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` and `FREENARY_VERSION`. The compose default is `latest`, the newest release; the other published tags are `X.Y.Z`, `X.Y`, `X`, `main`, `dev` and `sha-<7 characters>`.

Full walkthrough: [Contribute](apps/fumadocs/content/docs/next/contribute.mdx) and [Install Freenary](apps/fumadocs/content/docs/next/get-started/install.mdx).

## Frontend Architecture: Feature-Sliced Design

`apps/web` and `apps/fumadocs` are each a [Feature-Sliced Design](https://fsd.how) root: `src/` holds layers, nothing else. The packages are not — FSD is for applications, and `@freenary/ui`, `@freenary/api` and the rest are libraries the apps consume.

```txt
src/app/        the application: routing, the router, the signed-in shell, global styles
src/pages/      one slice per screen; a page owns its composition, queries and handlers
src/features/   a user interaction two or more pages share (auth-gate, bank-connection)
src/entities/   a domain model two or more pages share (category)
src/shared/     infrastructure with no business rule: ui, lib, api, auth, config, i18n
```

Four rules carry the whole thing, and [Steiger](https://github.com/feature-sliced/steiger) enforces them:

- **A module imports only from a layer strictly below it.** `shared < entities < features < pages < app`. Nothing imports from `app`.
- **A slice is entered through its `index.ts`.** `@/pages/budget`, `@/features/bank-connection`, `@/entities/category` — never a path inside one. `shared` is entered per segment: `@/shared/api`, `@/shared/auth`, `@/shared/config`, `@/shared/i18n`, and per module for `@/shared/ui/<x>` and `@/shared/lib/<x>`.
- **Inside a slice, imports are relative**; across slices they use the alias. Both mistakes fail the gate.
- **Extraction is earned, never anticipated.** New code starts in the page that uses it. It moves down a layer when a second consumer exists, the responsibility is focused, and it has a reason to change of its own — which is why `features/` holds two slices and `entities/` one.

Segment names say what code is _for_, not what it _is_: `ui`, `model`, `api`, `lib`, `config`. A `components/`, `hooks/`, `utils/` or `types/` folder inside a slice is a lint error, and so is a `ui` segment in `app`.

```bash
bun run check:fsd                       # both apps, through turbo
cd apps/web && bun run lint:fsd         # one app; steiger reads steiger.config.ts
```

Run it from the app directory or through the script: steiger finds `steiger.config.ts` only when that file's directory is the working directory, and silently falls back to its own defaults otherwise. CI runs the gate as the **Architecture** step. Generated and framework files sit outside every layer — `src/routeTree.gen.ts`, `src/paraglide/` and `src/server.ts` in `apps/web` — and the Vite config points TanStack Start at `src/app/routes`.

## Documentation: Ship It With the Change

[`apps/fumadocs`](apps/fumadocs) is the public documentation site. It is **part of the change, never a follow-up** — a PR that alters documented behavior and leaves the docs stale is incomplete, and reviewers should treat it as such.

**Update the docs when your change touches any of these:**

- A user-visible flow or screen in `apps/web`.
- A public API route, its input schema, or its auth/permission rules.
- A domain concept, status enum, or any vocabulary in `packages/db` — the docs quote these verbatim, so a renamed enum value silently makes a page wrong.
- An environment variable, `compose*.yml` service, root `package.json` script, or a GitHub Actions workflow.
- A bank provider or email provider integration, or the credentials it needs.
- Architecture a new contributor would have to reverse-engineer from the diff.
- The contributor workflow itself: tooling, tests, hooks, or review expectations.

Pure refactors, internal helpers, and dependency bumps that change no documented behavior need no docs change. Say so in the PR rather than leaving it ambiguous.

**The docs are versioned.** `content/docs` holds one folder per version of Freenary: `next` for the unreleased code, and one frozen `X.Y` folder per release. **A change edits `next` and nothing else** — the `Release` workflow copies `next` to `content/docs/X.Y` before it tags, and a released folder only ever takes a correction to that release. Every page is served under its version (`/docs/next/use/budget`), a path with no version redirects to the newest release, and **an authored link never names a version**: write `/docs/use/budget` and the site resolves it inside the version being read. A moved or deleted page gets a pair in `apps/fumadocs/src/shared/config/moved-pages.ts` so its old URL still lands somewhere.

**Put it in the right section.** `content/docs/next/` holds `index.mdx`, then `get-started/` (install and first bank), `use/` (anyone signed in, no terminal), `run/` (the operator after install), `reference/` (every variable and alternative setup) and `contribute.mdx`. Each folder's `meta.json` holds the order. Internals go to `docs/engineering/`, not to the site. A fact lives in **exactly one** page; everywhere else links to it.

**Document what is true, and only what is true.** Read the code before writing the page, quote real names, and never describe a screen, flag, or endpoint that does not exist. Write plain, short, second-person prose; the full writing rules are in [`apps/fumadocs/AGENTS.md`](apps/fumadocs/AGENTS.md).

**Verify it.** Two gates, and neither one alone is enough:

```bash
bun run docs:check   # frontmatter, icons, components, links, anchors, navigation, moved pages
cd apps/fumadocs && bun run build
```

| Mistake | `bun run build` | `bun run docs:check` |
| --- | --- | --- |
| Missing or malformed frontmatter, or no `description` or `icon` | Fails | Fails |
| Unknown code-fence language | Fails | Fails |
| Frontmatter `icon` that is not in lucide's `icons` record | **Passes** — renders nothing | Fails |
| MDX component not registered in `src/shared/ui/mdx.tsx` | **Passes** — renders nothing | Fails |
| Dead internal link or `#anchor` | **Passes** | Fails |
| Page missing from its folder's `meta.json` | **Passes** | Fails |
| A link that names a version, or a version folder without `"root": true` | **Passes** | Fails |
| An operator code block in `use/` | **Passes** | Fails |
| A moved page with no pair in `moved-pages.ts` | **Passes** | Fails |

A green gate therefore is not proof the page is right. Load the page you changed and look at it.

## Environment Variables: One Schema, Two Generated Files

Every server variable is declared once, in [`packages/env/src/schema.ts`](packages/env/src/schema.ts), with a `.describe()` sentence and a `.meta({ section, example, onError })` block; `packages/env/src/server.ts` only hands that object to `createEnv`, and the client variables live in `schema-web.ts`. `bun run env:sync` writes the two artifacts from it: the root `.env.example`, and the tables of `apps/fumadocs/content/docs/next/reference/configuration.mdx`, between the `{/* env-sync:start … */}` and `{/* env-sync:end */}` markers. **Neither artifact is edited by hand** — the next sync overwrites the edit.

`bun run env:check` is the same script with `--check`, and CI runs it as the **Environment** step; a `lefthook` pre-commit job runs `env:sync` and stages what it writes. The generator also refuses a schema key that carries no `.describe()`, `example` or `onError`, a `process.env.X` read that no schema and no allow-list declares, a `${VAR}` in a compose file that nothing declares, and an allow-list entry that no file uses. Adding a variable is therefore a schema edit plus `bun run env:sync`: the compose files no longer list pass-through variables, so no compose edit is part of it.

## Interface Text: Every String Is a Message Key

`apps/web` ships in English and French. Every user-facing string it renders is a key in `apps/web/messages/en.json` and `messages/fr.json`, and **a change that adds or edits UI adds or edits both catalogs in the same commit**. A key present in `en.json` and missing from `fr.json` compiles with no error and no warning — the French branch aliases to the English one, so English reaches French readers and no build step catches it.

The rules live next to the code they govern: [`apps/web/AGENTS.md`](apps/web/AGENTS.md#internationalization) for catalogs, message discipline and locale-aware formatting; [`packages/ui/AGENTS.md`](packages/ui/AGENTS.md) for primitives' accessible names; [`packages/api/AGENTS.md`](packages/api/AGENTS.md) for why responses carry slugs rather than labels. The mechanism is Paraglide: `apps/web/src/paraglide/` is generated, and every component imports the message functions as `m`. What readers see is documented at [`content/docs/next/use/account.mdx`](apps/fumadocs/content/docs/next/use/account.mdx).

## Branches and Releases

Pull requests target `dev`, the integration branch; `main` holds released code, and a push to either branch publishes the `ghcr.io/suiramdev/freenary-server` and `ghcr.io/suiramdev/freenary-web` images under that branch name. A maintainer releases by merging a docs snapshot (`bun run docs:snapshot X.Y.Z`) into `dev`, merging `dev` into `main`, and running the `Release` workflow, which refuses a stable version without its snapshot, then creates the `vX.Y.Z` tag, the versioned images and the GitHub release. The web image carries its version from the build argument `FREENARY_VERSION`, which is what its account-menu documentation link points at. Contributors never tag and never bump a version — see [Contribute](apps/fumadocs/content/docs/next/contribute.mdx).

## Pull Request Descriptions: Complete, Then Brief

- **Reviewers skim.** A description they have to scroll does not get read, so keep the whole body under ~400 words. Fill every section; pad none.
- **Summary:** at most four sentences — what changed, and what to look at first.
- **Motivation, Drawbacks, Prior art:** at most four short bullets each. Drawbacks and Prior art carry the honest costs and the rejected alternatives, not a sales pitch.
- **Notes:** one line per fact — `Closes #n`, the visual change (or explicitly none), the tests added, the `apps/fumadocs` pages updated (or explicitly none, and why), the short review summary `CONTRIBUTING.md` asks for, and any migration, breaking change, or merge-order constraint.
- Don't restate the issue, list changed files, narrate the implementation, or paste command output — reviewers open the diff and the linked issue for that.
- Evidence a reviewer may want but need not read (verification logs, benchmark runs) belongs in a PR comment, not the description.
- A section that needs a table or a code block is a smell: that detail belongs in the issue, the code, or a comment.

**Review gate.** This rule binds the top-level agent that owns an integration. A subagent returns its result to whoever spawned it and never runs the gate itself; the `reviewer` never invokes another reviewer.

Once an integration is implemented and smoke-tested, the owning agent runs the `reviewer` agent over the change before yielding or opening a pull request. It is read-only and returns a `verdict` plus a `findings[]` list; any finding at any severity means `changes_requested`. Fix every finding, then rerun the reviewer. If you believe a finding is wrong, send your counter-evidence back to the reviewer and let it re-judge — never overrule it yourself. The work is not complete until the reviewer returns `approved` with an empty `findings` list.

---

# Code Standards: Ultracite and oxslop

This project runs **Ultracite** (Oxlint + Oxfmt) for the general standard, and the **`oxslop`** plugin on top of it. `oxlint.config.ts` extends the Ultracite `core`, `react` and `tanstack` presets and the fragment that `oxslop({ strict: true })` returns from `oxslop/config`, which carries the plugin, the rules and the test-file overrides. All 39 oxslop rules are `error`, across its four groups — `core`, `effect`, `style` and `testing`. `apps/fumadocs` is a standalone app with its own `.oxlintrc.json`, which extends `presets/all.json` instead, because Oxlint resolves `extends` against the config file and JSON takes no function call.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Lint under Bun** (a TypeScript config needs Bun or Node 22.18+): `bunx --bun oxlint`
- **Diagnose setup**: `bun x ultracite doctor`

Most formatting issues fix themselves, and so do `require-readable-spacing`, `expect-padding` and `prefer-option-from-nullable`, the three oxslop rules that carry a fix. The rest do not: `no-comments`, `no-vague-identifiers`, `no-array-filter-map`, `no-try-catch` and `no-switch` are hand work.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Model an async failure with Effect, not with `try`/`catch`
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- `oxslop/no-try-catch` bans `try`/`catch` and `try`/`finally`. Model the failure instead — see the Effect section below
- Prefer early returns over nested conditionals for error cases
- `oxslop/no-silent-error-swallow` bans a catch handler that ignores the error and returns `Effect.void` or an empty success; carry it in the error channel, or log it with `Effect.logWarning` and name the error parameter

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Code Comments: There Are Almost None

`oxslop/no-comments` rejects every comment except a `SAFETY:` justification, a tooling directive (`@ts-`, `oxlint-`, `eslint-`, `biome-`, `prettier-`, `c8 `, `v8 `, `istanbul `, `#region`, `#endregion`), a `/// <reference …>`, a `/*! … */` licence banner, a `/* @__PURE__ */` annotation and a shebang. JSDoc is exempt in oxslop by default; `oxlint.config.ts` passes `allowJsdoc: false`, so it is not exempt here.

- **The code carries the meaning.** A name that needs a sentence beside it is the wrong name. Rename the symbol, name the intermediate value, extract a named function, tighten the type, or turn the literal into a named constant.
- **Durable knowledge goes in a document.** A vendor's documented quirk, a protocol constraint, a measured number's provenance: [`docs/engineering/`](docs/engineering) holds one file per area (`web-ui`, `web-app`, `api`, `categorisation`, `data-pipeline`, `platform`), keyed by `path › symbol`; a package's `AGENTS.md` holds a rule contributors need; `apps/fumadocs` holds anything a reader needs. `docs/engineering/platform.md` also records the oxlint rule interactions that bite when writing Effect here.
- **`SAFETY:` is only for an assertion.** It states the invariant that makes one `as` sound. `oxslop/require-safety-comment-for-type-assertion` reads it only on a line the assertion itself spans, or directly above the whole statement the assertion sits in — not above an object property or a JSX attribute in the middle of one. Where that reads badly, bind the assertion to a named `const` and put the justification above it. Never write one to smuggle prose past the rule, and never add an `oxlint-disable` for `no-comments`.

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Serve images from `public/` and set explicit `width`/`height` to avoid layout shift

### Framework-Specific Guidance

**TanStack Start (both `apps/web` and `apps/fumadocs`):**

- Declare document metadata in a route's `head` option, never with a raw `<head>` write
- Load route data in `loader` or a `useQuery`, never in a component body
- Declare a component as an arrow function assigned to a `const`, before the `Route` that references it

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

### Effect v4

`effect@4.0.0-rc.115` is a root dependency, and the packages that import it declare it too. The authoritative reference ships with the library: read `node_modules/effect/AGENTS.md`, the examples under `node_modules/effect/ai-docs/src/**`, and the `.d.ts` files in `node_modules/effect/dist/`. Names changed from v2 and v3: `Result` (not `Either`), `Context.Service`, `Schema.TaggedError`, `Data.TaggedError`, `Effect.fn`, `Effect.catchTag`.

Where it earns its keep:

- **Typed errors.** `Data.TaggedError("ProviderRequestFailed")<{ … }>` beside the code that raises it, `Effect.catchTag` to recover. `Schema.TaggedError` when the payload crosses a wire.
- **A sync call that throws.** One module-level `Option.liftThrowable(…)` or `Result.try({ try, catch })`, then `Option.match` at the call site. Never `Effect.runSync(Effect.try(…))`: it pays for a fiber to do nothing.
- **Async work with more than one failure mode.** `Effect.tryPromise` inside `Effect.fn("name")`, one `Effect.runPromise` at the module's own edge, so the exported signature stays a promise.
- **Cleanup.** `Effect.acquireRelease` with `Effect.scoped`, which is what replaced `try`/`finally`.
- **Bounded concurrency.** `Effect.forEach(items, run, { concurrency: n })` instead of a hand-rolled batching loop.
- **Dispatch.** `Match.value(…)` with `Match.exhaustive`, `Match.tag`, or a `satisfies Record<Key, …>` table when the arms are wide.

Where it does not:

- **zod stays** at the boundaries a library owns: oRPC route contracts, `@t3-oss/env-core`, better-auth options, AI SDK tool schemas.
- **No Effect in a render path**, in a `useMemo`, or per row in `packages/api/src/categorisation`, which runs over every transaction. `Option`, `Result`, `Match` and `Predicate` are fine there; a fiber is not.
- **No service or `Layer`** for a module with one implementation and no lifecycle.
- `apps/fumadocs` depends on no workspace package and does not carry `effect`.

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting
- Tests run with `bun test <path>`. There is no root `test` script and CI runs no tests, so run the files your change touches by hand.

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Name things so the code reads itself, and put durable facts in `docs/` or `apps/fumadocs`

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.
