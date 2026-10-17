# Documentation validation

What was run for the rewrite, and what wasn't. "Ran" means executed; "reasoned" means not.

## Gates (ran, final state)

| Command | Result |
| --- | --- |
| `cd apps/fumadocs && bun scripts/check-docs.ts --strict` | 60 pages, 11 meta files, 0 errors, 0 warnings |
| `cd apps/fumadocs && bun run build` | Exit 0 |
| `cd apps/fumadocs && bun run types:check` | Exit 0 |
| `bunx --bun oxlint`, `bun x ultracite check` on changed code | Exit 0 |
| `bun run env:check` | 48 declared variables, both artifacts current |

The build prerenders no `next` page, so `vite preview` served the built site and every `next` page was requested: 22 of 22 answered `200` as HTML and as `.md`, each with its own `<title>` and meta description. `vite dev` failed on every route of the site with `Vite environment "ssr" is unavailable`, an environment fault unrelated to the pages.

Every repository link in `next` (5 unique URLs) answers `200`, and its one heading anchor exists on `dev`. `docs:check` checks internal links and anchors; it fetches no external link.

## Commands from the pages (ran)

Against throwaway containers, removed afterwards:

- The local contributor path in `contribute`, on a scratch worktree: install, `.env` files, PostgreSQL, migrations, `bun run dev`, sign-up.
- Backup with `pg_dump -Fc`; restore over a live database with `--clean --if-exists --no-owner`; restore into an empty database on a fresh volume; restore under a different `BETTER_AUTH_SECRET`.
- Every startup failure in `run/troubleshooting`: missing or short secret, missing `.env` with variables exported, invalid URL, changed `POSTGRES_PASSWORD`, half-set email variables, unreadable instance configuration.
- Every path, method, status and error body in `reference/api`, against a running API server.

The live restore was later changed to stop `web` and `server` first; that exact sequence was not run again.

## Reader journeys (ran)

A separate agent used only the built `next` pages, Docker, and `FREENARY_VERSION=dev` in place of `latest`. The `dev` images were built from the same commit as this branch's base.

| Journey | Outcome | Changed afterwards |
| --- | --- | --- |
| **Newcomer:** localhost try-out, operator account, skip setup | Worked: start order, sign-in screen, `isOperator: true`, setup completed | The try-out broke on non-default ports; the page now says which variables to set, including `POSTGRES_PORT`. `api` gained the sign-up body. `procedures` explains `restartRequired` and how to skip setup by API |
| **Integrator:** cookie, `auth.viewer`, `budget.getAccounts`, `settings.listCategories` on both paths, OpenAPI document, error cases | Every documented output, cookie attribute and error matched | Unknown-procedure `404` body now documented |
| **Troubleshooter:** six startup failures, 502, backup, both restores, wrong secret | Every real output matched its troubleshooting entry | "The server log stays silent" narrowed to the browser's own calls |

An AI agent followed the steps; that shows they run as written, not that a person understands them. A human Getting Started run from a clean machine is still required before release.

## Not validated

- Dokploy and Coolify tabs. The labels come from vendor documentation, not a panel.
- Linking a real Powens or Enable Banking bank (needs vendor credentials and an HTTPS domain).
- Email through Resend or SMTP; Google, Apple and single sign-on; passkeys in a browser; an outside assistant model.
- The hosting-panel `docker exec` restore variants.
- `/llms.txt` lists the newest release only, by design, so it carries no `next` page.
