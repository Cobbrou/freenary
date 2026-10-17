# Documentation review

Review of the full rewrite of `apps/fumadocs/content/docs/next` (2026-10-17 and 18). [`docs-plan.md`](docs-plan.md) holds the scope and [`docs-validation.md`](docs-validation.md) what was run.

## How the pages were written

1. Six read-only inventories listed every fact for one area, each with a `path:line` or the command that showed it. They are in [`evidence/`](evidence).
2. The sitemap, the reader goal of each page, the anchors other code links to, and which page owns each fact were fixed before any writing.
3. Writers worked from the inventories and the code only. A first round edited the old pages instead of replacing them. Those 12 pages were emptied and written again by writers forbidden to read any old page, any frozen version or any earlier audit.
4. Each page was compared sentence by sentence with its previous version:

| Share of sentences kept from the old page | Pages |
| --- | --- |
| 0% | `contribute`, `reference/from-source`, `reference/scaling`, `reference/security`, `run/email`, `run/updates-and-backups` |
| 1–10% | `index`, `reference/configuration`, `reference/glossary`, `reference/procedures`, `reference/reverse-proxy`, `run/sign-in`, `use/budget` |
| 11–33% | `get-started/*`, `reference/api`, `reference/bank-providers`, `run/troubleshooting`, `use/account`, `use/assistant`, `use/bank-connections` |

The kept sentences are mostly quoted UI labels, error strings and one-line facts that have one correct wording. Total length fell from about 26,000 to 21,900 words; `reference/procedures` fell from 6,455 to 3,655.

## What the evidence changed

Claims the old pages got wrong, or left out, that the rewrite states from code:

- Custom categories apply to budget lines only; a transaction takes a built-in category.
- Resetting a category undoes the choice for every transaction of that company.
- No screen changes a password. `Forgot password?` exists only with email configured.
- Tax residency is fixed after onboarding and decides only the bank list.
- With no email provider, a Google, Apple or single sign-on sign-in is refused for an address that already has a password account. The page quotes the message and gives the two ways out.
- `instance.check` never returns `NOT_IMPLEMENTED`; a disabled integration answers `verified`.
- `instance.save` always answers `restartRequired: true`; `instance.complete` decides.
- Powens receives only the start of a sync window; Enable Banking receives both ends.
- A server image starts the API server; Compose reuses it for `migrate`.
- `bun install` needs Node 20.19+, 22.12+ or 24+ for Prisma's install check.
- `/rpc` and `/api-reference` reach the same handlers; blocking one path hides only the reference page and the OpenAPI document.
- An unknown procedure answers `Not Found` as text, not the JSON error body.

Two interface strings made false claims and were corrected in `en.json` and `fr.json`: `assistant_model_none_chosen` and `onboarding_country_description`.

## Independent review

A reviewer on a different model (GPT-5.6) audited all 22 pages against the code with no access to the writers' reports. It returned 10 findings, all fixed:

1. `index` named two places data leaves the instance; it now names all six and links Security.
2. The Coolify template URL on `main` returned `404`. `next` now links the `dev` branch, through `gitConfig.branch` in `apps/fumadocs/src/shared/config/site.ts`, and the snapshot pins it to the release tag. The rule documents changed with it.
3. The live restore ran while the server accepted writes. It now stops `web` and `server` first.
4. Every page had the same `<title>` and no meta description. The docs route now emits both from the page frontmatter.
5. `index` implied custom categories go on transactions.
6. Running without Docker skipped creating the PostgreSQL role and database.
7. A repository anchor existed only on `dev` (fixed by 2).
8. `procedures` said a procedure with no **Errors** line could fail only on access or schema.
9. `bank-providers` repeated sync facts owned by `use/bank-connections`.
10. `from-source` said the server image runs migrations.

The reviewer's verdict on the fixed state is in `docs-validation.md`.

## Needs maintainer review

The plan's "Questions for a maintainer" holds the detail: panel labels, vendor facts, internal transfers in totals, `EUR` on assistant totals, `BETTER_AUTH_SECRETS`, the dead `NOT_IMPLEMENTED` path, the undeclared Node requirement, two failing unit tests, untranslated strings, and the Dokploy tab naming branch `main` before `deploy/` reaches it.
