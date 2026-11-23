# AGENTS.md

Freenary is a self-hosted personal finance app: a Bun + Turborepo monorepo with an Elysia/oRPC API server (`apps/server`), a TanStack Start web app (`apps/web`), shared packages (`packages/*`) and a docs site (`apps/fumadocs`) that renders `docs/`.

Read only what your task needs. Start from the table, follow links from there.

## Where to look

| Task | Read first |
| --- | --- |
| Understand the system | [docs/explanation/architecture.md](docs/explanation/architecture.md) |
| Run the code locally | [docs/how-to/contribute/run-from-source.md](docs/how-to/contribute/run-from-source.md) |
| Lint, format, layers, i18n, Effect, tests | [docs/reference/code-conventions.md](docs/reference/code-conventions.md) |
| Run the same checks as CI | [docs/how-to/contribute/run-checks.md](docs/how-to/contribute/run-checks.md) |
| Add or change an environment variable | [docs/how-to/contribute/add-an-environment-variable.md](docs/how-to/contribute/add-an-environment-variable.md) |
| Change the database schema | [docs/how-to/contribute/change-the-database-schema.md](docs/how-to/contribute/change-the-database-schema.md) |
| Add an API procedure | [docs/how-to/contribute/add-an-api-procedure.md](docs/how-to/contribute/add-an-api-procedure.md) |
| Add a bank provider | [docs/how-to/contribute/add-a-bank-provider.md](docs/how-to/contribute/add-a-bank-provider.md) |
| Change behaviour a page documents | [docs/how-to/contribute/update-the-docs.md](docs/how-to/contribute/update-the-docs.md) |
| Settings saved in the app vs environment | [docs/explanation/settings-sources.md](docs/explanation/settings-sources.md) |
| Categorisation pipeline | [docs/explanation/categorisation.md](docs/explanation/categorisation.md) |
| Open a pull request | [docs/how-to/contribute/open-a-pull-request.md](docs/how-to/contribute/open-a-pull-request.md) |
| Issues, labels, triage | [.github/triage/issue-tracker.md](.github/triage/issue-tracker.md), [.github/triage/triage-labels.md](.github/triage/triage-labels.md), [.github/triage/triage.md](.github/triage/triage.md) |
| Self-hosting questions | [docs/index.md](docs/index.md) or [docs/llms.txt](docs/llms.txt) |

## Commands you will use

```bash
bun install
bun run dev:up          # full dev stack in Docker (see run-from-source.md)
bun run check           # Ultracite: Oxlint + Oxfmt
bun run check-types
bun run check:fsd       # Feature-Sliced Design layers (apps/web, apps/fumadocs)
bun test <path>         # CI runs only packages/api tests
bun run env:sync        # regenerate .env.example + docs/reference/configuration.md
bun run docs:generate   # regenerate docs/reference/{api,commands,compose-files}.md and openapi.json
bun run docs:check      # docs links, anchors, frontmatter, meta.json, llms.txt, generated files
```

Every script: [docs/reference/commands.md](docs/reference/commands.md).

## Rules that are easy to miss

- Pull requests target `dev`.
- Attach screenshots with `gh pr create --attach <file>`, `gh pr edit --attach` or `gh pr comment --attach` ([Attaching files with GitHub CLI](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli)). Never commit images or push a branch to host them.
- Never edit generated files by hand: `.env.example`, `docs/reference/configuration.md`, `docs/reference/api.md`, `docs/reference/openapi.json`, `docs/reference/commands.md`, `docs/reference/compose-files.md`, `apps/web/src/paraglide/`, `routeTree.gen.ts`.
- A change to documented behaviour updates `docs/` in the same pull request. Keep pages to one Diátaxis type, and state only what the code shows.
- Every user-facing string in `apps/web` is a key in both `apps/web/messages/en.json` and `fr.json`.
- Code comments are rejected by the linter (`oxslop/no-comments`), except the exceptions listed in code-conventions.md.
