# Contributing to Freenary

Thanks for contributing to Freenary.

## Before You Start

- Read [`CONTEXT.md`](../CONTEXT.md) — Freenary is an open-source personal finance and wealth-management platform. Keep changes aligned with that vision.
- Set up from [Contribute](../apps/fumadocs/content/docs/next/contribute.mdx) in the documentation: it holds the first-run steps and both ways to run the code. This file holds the rules a pull request follows. [`docs/engineering`](../docs/engineering) covers how the internals work.
- Keep changes scoped to a clear user-facing improvement, bug fix, or refactor.
- Follow the code standards in [`AGENTS.md`](../AGENTS.md) — the repo uses Ultracite (Oxlint + Oxfmt) with strict, auto-fixable rules.

## Working on an Issue

Anyone can contribute, and you do not need to be a maintainer or ask first to open a pull request for a fix. For an issue that is already open, this is how work is shared.

**Find something to do.** Issues labelled [`good first issue`](https://github.com/suiramdev/freenary/labels/good%20first%20issue) are small and fully specified, a good place to start. Issues labelled [`help wanted`](https://github.com/suiramdev/freenary/labels/help%20wanted) are fully specified and open to anyone. Both labels mean the spec is complete: the issue states the context, the expected behavior, the acceptance criteria and the files to start from. An issue with a **Still to define** list still has open questions, so it carries neither label yet. You can help by proposing an answer in a comment.

**Claim an issue.** Comment on it to say you will take it. A maintainer assigns it to you, usually within a few days. Wait for the assignment before you invest a lot of time, so two people do not build the same thing. Claim one issue at a time while you are new.

**Keep the claim alive.** Open a draft pull request early, or leave a short update when you are stuck. A claim with no pull request and no update for 14 days is stale: a maintainer asks for news, and if there is none, unassigns you and opens the issue to others. That is routine, and you are welcome to claim it again later.

**Open the pull request.** Follow [Pull Requests](#pull-requests) below. Write `Closes #n` in the Notes of the pull request, and check each acceptance criterion of the issue before you ask for a review. If the spec turns out to be wrong or incomplete, say so in the issue instead of guessing.

**Report something new.** Use the [issue forms](https://github.com/suiramdev/freenary/issues/new/choose). A maintainer sets the labels, and the `Triage` workflow suggests a type and lists what is missing from the description. If you can specify the work completely, use the **Specified task** form. The triage rules are in [`docs/engineering/triage.md`](../docs/engineering/triage.md).

## Branch Naming

Use a clear, descriptive branch name that reflects the change.

Good examples:

- `fix/login-redirect-loop`
- `feat/portfolio-holdings-view`
- `chore/update-contributor-guide`

Avoid vague names like `test`, `misc`, or `changes`.

## Before Opening a PR

Run the same commands as CI's `ci` job, in this order:

```bash
bun install --frozen-lockfile
bun run check         # Oxlint + Oxfmt
bun run check-types   # TypeScript
bun run check:fsd     # Feature-Sliced Design layers and public APIs
bun run docs:check    # documentation gate
bun run env:check     # .env.example and the configuration reference match packages/env
(cd packages/api && bun test)   # api tests, without the downloaded data
bun run build         # every app
```

Most lint/format issues are auto-fixable with `bun run fix`.

CI's `compose` job has no root script. It parses `docker-compose.dev.yml` (alone and with `docker-compose.mail.yml`), `docker-compose.proxy.yml`, `docker-compose.yml`, `deploy/docker-compose.yml` and `deploy/coolify.yml` with `docker compose config --quiet`. It also asserts that `docker-compose.yml` refuses an empty `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`, and that `deploy/docker-compose.yml` refuses an empty `FREENARY_URL`, `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`. Reproduce it from [`.github/workflows/ci.yml`](workflows/ci.yml) before you change any of these files.

CI runs no tests, and there is no root `test` script. Run the test files your change touches by hand with `bun test <path>`.

`apps/web` and `apps/fumadocs` follow [Feature-Sliced Design](https://fsd.how): a module imports only from a lower layer, a slice is entered through its `index.ts`, and code starts in the page that uses it rather than in a speculative `features/` or `entities/` slice. `bun run check:fsd` is that rule set, and CI runs it as the **Architecture** step. The layout and the import forms are in the [repository guide](../AGENTS.md#frontend-architecture-feature-sliced-design).

If your change affects UI, verify it in the browser, including light and dark mode.

If your change alters documented behavior — a screen, an API route, an environment variable, a `packages/db` enum, a script, or a provider integration — update [`apps/fumadocs`](../apps/fumadocs) in the same pull request. The documentation is versioned: edit `content/docs/next`, which documents the unreleased code, and leave the frozen `content/docs/<X.Y>` folders alone. The writing rules are in [`apps/fumadocs/AGENTS.md`](../apps/fumadocs/AGENTS.md). `bun run docs:check` checks links, navigation and frontmatter, and CI runs it.

## Pull Requests

Follow the [pull request template](pull_request_template.md). Each pull request should:

- open against `dev`; `main` holds released code, and a release is cut from `main` after `dev` merges into it
- explain the user-visible change
- stay focused on a single topic when possible
- show new UI or behavior changes in the optional Evidence section: screenshots or a screen recording dragged into the description so GitHub hosts them, with fake data only, no real keys, tokens or personal data, and no file paths from your machine
- say which `apps/fumadocs` pages it updated, or state that none needed a change

Evidence is the only optional section; delete it when it does not apply. If there is no visual change, say so in Notes. Reviewers and QA check Evidence on a pull request that changes the interface, and ask for it when it is missing. No check fails without it.

## Licensing Your Contribution

Freenary is licensed under the [GNU Affero General Public License v3.0 or later](../LICENSE). When you open a pull request, you license your contribution under the same terms, and you confirm that you have the right to do so.

Sign off every commit to state that:

```bash
git commit -s -m "fix: stop the login redirect loop"
```

`-s` appends a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org). Set `git config user.name` and `user.email` to a real name and address first.

Do not paste code from a source whose license forbids it, and do not add a dependency under a license that the AGPL cannot distribute — a proprietary license, or a stronger copyleft such as the SSPL. MIT, ISC, BSD, Apache-2.0 and MPL-2.0 are all fine. A new vendored file that carries its own copyright notice keeps that notice, and the notice goes in [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).

## Release Process

Releases are maintainer-managed: a maintainer merges a docs snapshot (`cd apps/fumadocs && bun run docs:snapshot X.Y.Z`) into `dev`, merges `dev` into `main`, and runs the `Release` workflow, which creates the tag, the images and the GitHub release. Do not tag, and do not include a version bump in a normal contribution unless a maintainer asks for one. See [`docs/engineering/releasing.md`](../docs/engineering/releasing.md).
