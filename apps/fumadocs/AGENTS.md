# `apps/fumadocs`

The public documentation website.

## Stack

- **Fumadocs** (`fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui` aliased to `@fumadocs/base-ui`) — page tree, MDX pipeline, local search, and the theme's components.
- **TanStack Start** on **Vite** — same toolchain as `apps/web`, with SSR plus build-time prerendering. Nitro preset `vercel`; there is no Dockerfile for this app, and `docker-compose.yml` has no `docs` service.
- **Tailwind v4** via `@tailwindcss/vite`. `src/app/styles/app.css` imports `tailwindcss`, then Fumadocs' `neutral` and `preset` stylesheets. It does **not** import `@freenary/ui/globals.css`, so the docs palette is Fumadocs' own and does not follow `apps/web`.
- `bun run dev` serves on port **4000**, hardcoded in the `dev` script. `DOCS_PORT` is set by `docker-compose.dev.yml` and read by nothing; `DOCS_HOST` is only the Traefik route of the dev stack.

## Layout

```
content/docs/
  meta.json         # the version list, and the dropdown order
  next/             # MDX pages for the unreleased code — the folder you edit
  <X.Y>/            # one frozen copy per release, written by the snapshot script
src/                # a Feature-Sliced Design root
  app/
    routes/         # TanStack Router file routes, plus the api and llms endpoints
    router/router.tsx
    api/chat.ts     # the Ask AI handler
    start.ts        # unversionedDocsRedirect, then markdownRepresentationRedirect
    styles/app.css
  pages/
    home/           # the landing page
    docs/           # ui/documentation-page.tsx, api/load-doc.ts
  shared/
    ui/             # mdx.tsx (the MDX component map), markdown.tsx, ai-search.tsx, button.tsx, not-found.tsx
    lib/            # versions.ts (version ids, ordering, link resolver), markdown-url.ts (.md URL codec), cn.ts
    config/         # site.ts (app name, docs base route, repo coordinates), layout-options.ts (nav and GitHub options), moved-pages.ts (old slug → new slug)
    content/        # source.ts (content dir, page tree, LLM text, version list, findMovedPage)
  routeTree.gen.ts  # generated, outside every layer
scripts/
  check-docs.ts     # the gate
  snapshot-version.ts  # freezes `next` as a release folder
```

`src/` obeys Feature-Sliced Design, and `bun run lint:fsd` (steiger) is the gate. Three layers stack, `shared < pages < app`, and a module imports from a strictly lower layer alone. A slice is reached through its `index.ts` — `@/pages/docs` — and `shared` per segment (`@/shared/config`, `@/shared/content`) or per module for `ui` and `lib` (`@/shared/ui/mdx`, `@/shared/lib/versions`). Inside one slice, and inside `app/`, an import is relative. Steiger reads `steiger.config.ts` only when this directory is the working directory, so run the script from here or through the root `bun run check:fsd`. A segment name states a purpose: `components`, `hooks`, `utils` and `types` all fail.

## Versions

Every page is served under a version segment: `/docs/next/get-started/install`, `/docs/1.2/get-started/install`. The rules that follow from that:

- **Author in `content/docs/next`.** A change edits that folder alone. `content/docs/<X.Y>` is frozen: only a correction to that release touches it.
- **A folder under `content/docs` is a version.** Its `meta.json` carries `"root": true` and a `title` equal to the folder name. `root: true` is what scopes the sidebar to one version and makes Fumadocs render the version dropdown (`getLayoutTabs`, `TreeContextProvider`). `docs:check` fails a folder that breaks either rule.
- **A docs link never names a version.** Pages write `/docs/use/budget`; the `a` and `Card` wrappers in `src/shared/ui/mdx.tsx` prepend the version of the page being read, and `getLLMText` does the same for the `.md` output. `docs:check` fails an authored link that names a version.
- **A repository link names the branch, and the snapshot pins it.** Pages write `https://github.com/suiramdev/freenary/blob/dev/…`, the branch that holds the unreleased code; the snapshot rewrites each one to `blob/v<X.Y.Z>/` in the copy, because that link cannot resolve at render time. `docs:check` fails a `blob/dev` link inside a frozen version. The branch is `gitConfig.branch` in `src/shared/config/site.ts`.
- **`/docs/*` with no version redirects** (307) to the newest release. `unversionedDocsRedirect` in `src/app/start.ts` owns it. The newest release is `newestRelease()` in `src/shared/content/source.ts`: the highest `X.Y` folder, or `next` while no release exists.
- **A moved page keeps its old URL.** `src/shared/config/moved-pages.ts` lists `[before, after]` slug pairs. When a version has no page at the requested slug, `findMovedPage` looks up the pair in both directions and redirects to the counterpart that exists in that same version: `/docs/next/quickstart` lands on `get-started/install`, and `/docs/0.1/get-started/install` lands on `quickstart`. `loadDoc` and the `.md` route both use it. When you move or delete a page, add a pair. `docs:check` fails a pair whose `after` is missing from `next`, and a page of the newest release that is gone from `next` with no pair.
- **The language rules apply to `next` alone**; the structure rules apply to every version. `check-docs.ts` skips `checkAuthoredLanguage` outside `next`.
- **A release needs its snapshot first, and it snapshots last.** A maintainer runs `bun run docs:snapshot X.Y.Z` in a pull request to `dev`; the `tag` job of `.github/workflows/release.yml` refuses a stable version whose `content/docs/X.Y` folder is missing (the `main and dev` ruleset admits no workflow push). The folder freezes at that merge, so a documentation change merged between it and the release reaches `next` alone and no gate reports it. The script derives the `X.Y` folder from the release version and pins the four moving forms `scripts/moving-refs.ts` holds: a repository link and a `raw.githubusercontent.com` download URL take `v<X.Y.Z>`, a ``Branch: `dev` `` deploy step takes `main` (`gitConfig.releaseBranch`), and a `FREENARY_VERSION=dev` line takes `X.Y`. `docs:check` reads the same table, so it fails a frozen page that still carries any of them. It stages the copy outside `content/docs` and rewrites the root `meta.json` on every run, so a repeat run finishes an interrupted one; a pre-release snapshots nothing.
- **Search, the AI panel and the LLM endpoints are scoped.** `/api/search` tags each record with its version and the default dialog passes `defaultTag` — the version of the pathname, or the newest release off the docs tree, from the root loader in `src/app/routes/__root.tsx`. `/api/chat` builds one index per version and honours the request body's version only when `listVersions()` holds it. `/llms.txt` and `/llms-full.txt` serve the newest release alone.

## Content structure

The site serves first-time readers who want a working instance, then the people who run and use it, then contributors. Every path below is inside a version folder; each folder's `meta.json` holds the order.

```
index.mdx             what Freenary is, who it is for, two buttons
get-started/          before-you-install → install → connect-a-bank
use/                  budget, bank-connections, assistant, account
run/                  email, sign-in, updates-and-backups, troubleshooting
reference/            configuration, bank-providers, reverse-proxy, security,
                      from-source, api, procedures, glossary
contribute.mdx        clone, run, checks, pull request
```

- **Get started** takes a reader from nothing to a synced bank: a server, one domain, a hosting panel or Docker Compose, then the setup screen. No reverse proxy walkthrough here; HTTPS comes from the reader's platform.
- **Use** is for anyone signed in. No terminal: `docs:check` fails a `bash`, `dotenv`, `yaml` or other operator fence in `use/`, and warns on an environment variable name.
- **Run** is for the operator after install. **Reference** holds every variable, provider detail and alternative setup. Internals (database tables, encryption, pipeline stages) go to the repository's `docs/engineering/`, not to the site.
- **A fact lives in one page**; everywhere else links to it.

## Writing rules

- Second person, present tense, active voice, natural tone. Contractions and `-ing` forms are fine.
- Short sentences and paragraphs. Start with what the reader wants to do, then how. Explain why a step exists in one clause.
- No filler or sales words ("note that", "in summary", "seamless", "robust", "simply run"). `docs:check` warns on each (`no-filler`); the list is `FILLER_PHRASES` in `scripts/docs-rules.ts`.
- One term per concept: **instance**, **operator** (the first account), **setup screen** (`/setup`), **your domain** and **`FREENARY_URL`**, **hosting panel**, **bank provider**, **bank connection**, **sync**, **assistant**. Avoid "the stack" and "origin" on beginner pages.
- Quote a UI label only when the reader has to find or press it. Never list every label, button or option.
- Code blocks are copy-paste correct and use `freenary.example.com` as the placeholder. Check every command and variable against the code.
- Callouts only for real traps: data loss, security, a bank link that fails.
- Every page has `title`, `description` and `icon`, states its purpose in the first two lines, and ends with at most three "Next" cards.
- Target length: Get started pages about 120 lines, `use/` and `run/` pages about 150.

## Checks

```bash
bun run docs:check          # from apps/fumadocs, or at the root
bun run docs:check --strict # warnings fail too; from apps/fumadocs only, turbo rejects the flag at the root
bun run build               # frontmatter schema, MDX compile, fence languages, prerender
```

Then `bun run dev` and open every page you changed. A green gate proves the page compiles and its links resolve, not that it is right.

| Mistake | `bun run build` | `bun run docs:check` |
| --- | --- | --- |
| No frontmatter `title`, `description` or `icon`, or an extra field | Fails (missing) | Fails |
| An unknown or missing code-fence language | Fails | Fails |
| An `icon` that is not in lucide's `icons` record | Passes, renders nothing | Fails |
| A component `src/shared/ui/mdx.tsx` does not register | Passes, renders nothing | Fails |
| An internal link or `#anchor` that resolves to nothing, or names a version | Passes | Fails |
| A page missing from its folder's `meta.json`, or a `meta.json` entry with no page | Passes | Fails |
| A version folder without `"root": true`, or with a stale title | Passes, drops out of the dropdown | Fails |
| A moved page with no pair in `moved-pages.ts`, or a pair pointing nowhere | Passes | Fails |
| A `blob/dev` repository link in a frozen version | Passes | Fails (releases only) |
| An operator code block in `use/` | Passes | Fails |
| An environment variable in `use/`, roadmap language, filler or a sales word (`no-filler`), a sentence over 35 words | Passes | Warns (`next` only) |

`scripts/check-docs.ts` reads the component list from `getMDXComponents()` and the icon list from lucide's own record, so neither can drift from the site. `scripts/docs-rules.ts` holds the fence languages and the phrase lists. A page switches a rule off for itself with `{/* docs-check disable: no-roadmap */}`.

## Conventions

- Add a page by dropping an `.mdx` file in `content/docs/next/`; the sidebar and search index pick it up. Order and grouping come from `meta.json` files in that tree — a new page must be added to its folder's `pages` array or it lands at the bottom, unordered. Nested folders each with their own `meta.json` are supported.
- The frontmatter schema in `src/shared/content/source.ts` needs `title`, `description` and `icon`. A page without one of the three fails the build with the file name and the field. `full` is the only other field it accepts.
- `icon` is resolved by the `lucideIconsPlugin` in `src/shared/content/source.ts` against **lucide's `icons` record**, which holds canonical PascalCase names only. A deprecated alias such as `AlertCircle` is a top-level `lucide-react` export but is absent from that record, so it renders nothing and only warns in the console. `docs:check` fails on it; to check one name by hand:
  ```bash
  grep -c "as CircleAlert }" node_modules/lucide-react/dist/esm/icons/index.mjs
  ```
- MDX may use only what `src/shared/ui/mdx.tsx` registers: Fumadocs' defaults (`Card`, `Cards`, `Callout`, `CalloutContainer`, `CalloutTitle`, `CalloutDescription`, the `CodeBlockTabs*` family, and the `pre`/`a`/`img`/`h1`-`h6`/`table` overrides) plus the components that file adds explicitly — `Accordion`, `Accordions`, `File`, `Files`, `Folder`, `Step`, `Steps`, `Tab`, `Tabs`, `TypeTable`. Anything else fails to render, the build stays green, and `docs:check` fails.
- Code fences always name a **Shiki** language. `env` is not one — use `dotenv`. An unknown language fails the build, not just the page. The ids this site uses are the list in `scripts/docs-rules.ts`.
- Internal links are absolute site paths with no extension and no version (`/docs/use/budget`). A folder's index page is the folder path itself. The rendered link carries the version of the page it sits on.
- Routes derive from the docs base route in `src/shared/config/site.ts`. Change it there, not inline, so the `.md` and `llms.txt` endpoints stay consistent.
- Filenames are `kebab-case`; components are arrow functions assigned to a `const`, declared **before** the `Route` that references them (see the root `AGENTS.md`).
- `check-types` is this app's TypeScript script, and the root `bun run check-types` runs it with every other workspace. Run `bun run lint:fsd` here too: it is the Feature-Sliced Design gate, and CI runs it as the `Architecture` step.

## Endpoints beyond the pages

- `/docs/<version>/<slug>.md` — raw Markdown for a page. The version index page is `/docs/<version>.md`; a path with no version redirects to the newest release first.
- `/llms.txt`, `/llms-full.txt` — the index and full corpus for LLM consumers, for the newest release alone. The only two that behave identically in dev and production.
- `/api/search` — local search backend. Each record carries its version as a `tag`, and the dialog filters on the version being read.
- `/api/chat` — the "Ask AI" panel, backed by OpenRouter. One search index per version, chosen by the `version` field of the request body. The index holds one record per heading section (`src/app/api/docs-search.ts`), and the `search` tool returns at most 5 of them, each with a 500-character excerpt. Every question re-sends the conversation, so the panel drops earlier tool parts before sending and the server drops them again (`withoutToolParts` in `src/shared/lib/chat-history.ts`); the model searches again when it needs to. It reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` straight from `process.env`; neither is declared in `packages/env`. The trigger renders even with no key. `src/app/api/chat-guard.ts` guards it before any model call: 429 past 20 requests per caller or 300 in all per 5-minute window, 413 past 32,000 characters, 400 on a body that is not JSON, holds more than 20 messages or any role other than `user` and `assistant`. Each answer stops at 1,024 output tokens. The counters live in the server's memory, so each instance counts on its own, and the caller is the `x-real-ip` (then `x-forwarded-for`) header Vercel sets — off Vercel a client can forge it, and only the global cap holds. `bun test src/app/api` runs its tests, including a follow-up question after a search on the real `next` index.

**Markdown output is production-only, and negotiation never fires.** Measured, both modes:

| Request | `vite dev` | `build` + `serve` |
| --- | --- | --- |
| `/docs/<slug>.md` | 404 | 200 `text/markdown` |
| `/docs/<slug>` + `Accept: text/markdown` | 307 → `.md`, which 404s | 200 `text/html`, no redirect |

The `{$}.md` route does not register under `vite dev` (upstream TanStack Start dev-router limitation), so `llmMiddleware` in `src/app/start.ts` redirects Markdown-preferring requests into a 404. In production the `.md` routes work, but the middleware never runs for a page URL — Nitro serves the prerendered HTML first. Don't document negotiation as working.

That redirect also emits an `http://` `Location` behind a TLS proxy, because it rebuilds the URL from `request.url`. Unfixed; it only matters if negotiation is ever revived.
