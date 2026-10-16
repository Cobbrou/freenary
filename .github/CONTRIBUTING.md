# Contributing to Freenary

Thanks for contributing to Freenary.

## Before You Start

- Read [`CONTEXT.md`](../CONTEXT.md) — Freenary is an open-source personal finance and wealth-management platform. Keep changes aligned with that vision.
- Read [Contribute](../apps/fumadocs/content/docs/next/contribute.mdx) in the documentation for the full workflow, and [`docs/engineering`](../docs/engineering) for how the internals work.
- Keep changes scoped to a clear user-facing improvement, bug fix, or refactor.
- Follow the code standards in [`AGENTS.md`](../AGENTS.md) — the repo uses Ultracite (Oxlint + Oxfmt) with strict, auto-fixable rules.

## Local Setup

Containerised stack (needs Docker and a free port 80, applies the migrations for you):

```bash
bun install
bun run dev:up            # PostgreSQL, migrations, API server, web app, docs site
```

Local stack, with the applications on your host:

```bash
bun install
cp .env.example .env      # the Postgres container reads the root .env
bun run db:start          # starts the Postgres container
bun run db:push           # applies the Prisma schema
bun run dev               # web on 3001, server on 3000, docs on 4000
```

There is no seed script. Create an account through the sign-in screen. `bun run dev:up` configures no email provider, so sign-up returns a session at once and asks for no code — and so does the `bun run dev` path above. To work on the one-time-code flows, start the stack with `bun run dev:mail` instead: it adds a Mailpit inbox and points the API server at it, so the sign-up code, the verification code and the password reset all land in that inbox. See [Contribute](../apps/fumadocs/content/docs/next/contribute.mdx) for the details, and [Configuration](../apps/fumadocs/content/docs/next/reference/configuration.mdx) for every environment variable.

## Branch Naming

Use a clear, descriptive branch name that reflects the change.

Good examples:

- `fix/login-redirect-loop`
- `feat/portfolio-holdings-view`
- `chore/update-contributor-guide`

Avoid vague names like `test`, `misc`, or `changes`.

## Before Opening a PR

Run the same checks that CI runs, in this order:

```bash
bun run check         # Oxlint + Oxfmt
bun run check-types   # TypeScript
bun run check:fsd     # Feature-Sliced Design layers and public APIs
bun run docs:check    # documentation gate
bun run build         # every app
```

Most lint/format issues are auto-fixable with `bun run fix`.

CI runs one more job that no root script covers: it parses every Compose file with `docker compose config --quiet`, and it asserts that `docker-compose.yml` still refuses an empty `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`. Reproduce it before you change either file.

CI runs no tests, and there is no root `test` script. Run the test files your change touches by hand with `bun test <path>`.

`apps/web` and `apps/fumadocs` follow [Feature-Sliced Design](https://fsd.how): a module imports only from a lower layer, a slice is entered through its `index.ts`, and code starts in the page that uses it rather than in a speculative `features/` or `entities/` slice. `bun run check:fsd` is that rule set, and CI runs it as the **Architecture** step. The layout and the import forms are in the [repository guide](../AGENTS.md#frontend-architecture-feature-sliced-design).

If your change affects UI, verify it in the browser, including light and dark mode.

If your change alters documented behavior — a screen, an API route, an environment variable, a `packages/db` enum, a script, or a provider integration — update [`apps/fumadocs`](../apps/fumadocs) in the same pull request. The documentation is versioned: edit `content/docs/next`, which documents the unreleased code, and leave the frozen `content/docs/<X.Y>` folders alone. The writing rules are in [`apps/fumadocs/AGENTS.md`](../apps/fumadocs/AGENTS.md). `bun run docs:check` checks links, navigation and frontmatter, and CI runs it.

## Pull Requests

Follow the [pull request template](pull_request_template.md). Each pull request should:

- open against `dev` — `main` holds released code, and `dev` is the branch a release is cut from
- explain the user-visible change
- stay focused on a single topic when possible
- include screenshots or screen recordings for new UI or behavior changes
- say which `apps/fumadocs` pages it updated, or state that none needed a change

If there is no visual change, say that explicitly in the PR description.

## Licensing Your Contribution

Freenary is licensed under the [GNU Affero General Public License v3.0 or later](../LICENSE). When you open a pull request, you license your contribution under the same terms, and you confirm that you have the right to do so.

Sign off every commit to state that:

```bash
git commit -s -m "fix: stop the login redirect loop"
```

`-s` appends a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org). Set `git config user.name` and `user.email` to a real name and address first.

Do not paste code from a source whose license forbids it, and do not add a dependency under a license that the AGPL cannot distribute — a proprietary license, or a stronger copyleft such as the SSPL. MIT, ISC, BSD, Apache-2.0 and MPL-2.0 are all fine. A new vendored file that carries its own copyright notice keeps that notice, and the notice goes in [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).

## Release Process

Releases are maintainer-managed: a maintainer merges `dev` into `main` and runs the `Release` workflow, which creates the tag, the images and the GitHub release. Do not tag, and do not include a version bump in a normal contribution unless a maintainer asks for one. See [Contribute](../apps/fumadocs/content/docs/next/contribute.mdx).
