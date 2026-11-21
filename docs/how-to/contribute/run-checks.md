---
title: Run the checks
description: Run the same lint, type, architecture, test and docs checks as CI.
---

This page helps you run, on your machine, every check the `CI` workflow (`.github/workflows/ci.yml`) runs on a pull request, and install the Git hooks that run some of them at each commit.

## Before you start

- A clone of the repository with your shell in its root folder, as in [Run from source](run-from-source.md).
- Bun 1.4.2 and Docker with Compose.

## Steps

### The `ci` job

Run these commands in this order. Each one is a step of the `ci` job.

1. Install the exact locked dependencies:

   ```bash
   bun install --frozen-lockfile
   ```

2. **Lint & format**: Oxlint and Oxfmt through Ultracite.

   ```bash
   bun run check
   ```

   `bun run fix` (`ultracite fix`) applies the fixes the tools can make.

3. **Type check**: every workspace's `check-types` script, then the `scripts/` folder.

   ```bash
   bun run check-types
   ```

4. **Architecture**: the Feature-Sliced Design rules in `apps/web` and `apps/fumadocs`, through Steiger.

   ```bash
   bun run check:fsd
   ```

5. **Documentation**: frontmatter, headings, links and anchors, fence languages, `meta.json` files and `docs/llms.txt` under `docs/`, plus the generated reference pages. See [Update the docs](update-the-docs.md).

   ```bash
   bun run docs:check
   ```

6. **Environment**: `.env.example` and `docs/reference/configuration.md` must match `packages/env/src/schema.ts`. See [Add an environment variable](add-an-environment-variable.md).

   ```bash
   bun run env:check
   ```

7. **API tests**: the tests of `packages/api`. They run without the downloaded merchant data.

   ```bash
   (cd packages/api && bun test)
   ```

8. **Build**: every app.

   ```bash
   bun run build
   ```

CI runs no other test files, and there is no root `test` script. Run the tests next to the code you change with `bun test <path>`, for example `bun test apps/web/src/features/instance-integration`.

### The `compose` job

9. Check that every development compose file parses:

   ```bash
   docker compose -f docker-compose.dev.yml config --quiet
   docker compose -f docker-compose.dev.yml -f docker-compose.mail.yml config --quiet
   docker compose -f docker-compose.dev.yml -f docker-compose.ai.yml config --quiet
   ```

10. Check that `docker-compose.yml` and `deploy/docker-compose.yml` parse with their required values, and refuse to start without them. The job writes throwaway `.env` files, so run this in a scratch clone, or move your own `.env` and `deploy/.env` aside first:

    ```bash
    printf 'POSTGRES_PASSWORD=x\nBETTER_AUTH_SECRET=y\n' > .env
    docker compose -f docker-compose.yml config --quiet
    : > .env
    docker compose -f docker-compose.yml config --quiet && echo "accepted empty values"
    printf 'FREENARY_URL=https://freenary.example.com\nPOSTGRES_PASSWORD=x\nBETTER_AUTH_SECRET=y\n' > deploy/.env
    docker compose -f deploy/docker-compose.yml config --quiet
    : > deploy/.env
    docker compose -f deploy/docker-compose.yml config --quiet && echo "accepted empty values"
    ```

    The two `config` runs with empty files must fail. If `accepted empty values` prints, the check fails.

11. Check `deploy/coolify.yml`, without the Coolify-only key `exclude_from_hc` that plain Compose rejects:

    ```bash
    grep -v 'exclude_from_hc' deploy/coolify.yml > /tmp/coolify.yml
    SERVICE_PASSWORD_POSTGRES=x SERVICE_HEX_64_AUTHSECRET=y SERVICE_URL_WEB=https://freenary.example.com \
      docker compose -f /tmp/coolify.yml config --quiet
    ```

### The commit hooks

12. Install the hooks that `lefthook.yml` declares:

    ```bash
    bun x lefthook install
    ```

    At each commit, the `pre-commit` hook runs these jobs on the staged files, one after the other:

    - `oxlint`: `bun oxlint --fix` on staged JavaScript and TypeScript files, and stages the fixes.
    - `oxfmt`: `bun oxfmt --write`, and stages the fixes.
    - `env-sync`: when the env schema, a compose file, `scripts/env-sync.ts` or `scripts/docs-markdown.ts` is staged, runs `bun run env:sync` and stages `.env.example` and `docs/reference/configuration.md`.
    - `docs-reference`: when `package.json`, a compose file, `apps/server/src/index.ts`, a file under `packages/api/src` or a docs generator is staged, runs `bun run docs:generate` and stages `docs/reference/openapi.json`, `api.md`, `commands.md` and `compose-files.md`.

## Check that it works

Each command exits with status 0. The last lines show the result, for example:

```text
env-sync: 51 declared variables, both artifacts current
```

and, for `bun run docs:check`:

```text
docs-check: <n> pages, no problems
```

## If something goes wrong

- ``env-sync: <file>: stale. Run `bun run env:sync`.`` → the schema changed and the generated files did not. Run `bun run env:sync` and commit both files.
- ``docs-reference: <file>: stale. Run `bun run docs:generate`.`` → run `bun run docs:generate` and commit the files it writes.
- ``Format issues found in above <n> files. Run without `--check` to fix.`` → run `bun run fix`, then `bun run check` again.
- `bun install --frozen-lockfile` fails because `bun.lock` does not match the `package.json` files → run `bun install` and commit `bun.lock`.

## Related

- [Code conventions](../../reference/code-conventions.md)
- [Open a pull request](open-a-pull-request.md)
