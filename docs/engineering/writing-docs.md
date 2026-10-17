# Writing documentation

How to write, check and release the pages of the documentation site in `apps/fumadocs`. Read it before you change a page. `apps/fumadocs/AGENTS.md` holds the deeper site internals: routing, search, the `.md` and `llms.txt` endpoints.

Two commands decide whether a page is acceptable:

```bash
bun run docs:check            # from the repository root, or from apps/fumadocs
cd apps/fumadocs && bun run build
```

Neither alone is enough. [What each gate catches](#what-each-gate-catches) gives the split. A green gate proves the page compiles and its links resolve, not that it is right: open every page you changed in the browser.

## Run the site

```bash
cd apps/fumadocs
bun run dev
```

The site answers on `http://localhost:4000`. The development stack serves the same app at `http://docs.<slug>.freenary.localhost` (see [Local development stack](./local-stack.md)). Pages live under `apps/fumadocs/content/docs/`, and the base route is `/docs`.

## Versions

The site publishes one copy of the documentation for each version of Freenary. `content/docs` holds one folder per version, and the folder name is the version:

```text
content/docs/
  meta.json      the version list, which orders the version dropdown
  next/          the unreleased code: the folder you edit
  0.1/           one frozen copy per release
```

- **Write in `next`.** A pull request edits `next` and nothing else. A frozen `X.Y` folder changes only for a correction to that release. Copy the correction into `next` too when it still applies there.
- **A link never names a version.** Write `/docs/use/budget`. The site adds the version of the page the reader is on, so one page body serves every version. `docs:check` fails a link that names a version. In a browser, a path with no version lands on the newest release.
- **The writing rules apply to `next` alone.** A frozen version passed them when it was written. The structure rules (links, `meta.json`, frontmatter) apply to every version, because a dead link breaks a page someone opens today.
- **A moved page keeps its old URL.** When you move or delete a page, add a `[before, after]` pair to `apps/fumadocs/src/shared/config/moved-pages.ts`. `docs:check` fails a page of the newest release that is gone from `next` with no pair.

### Freeze a version

A maintainer freezes `next` before a release, in a pull request to `dev`:

```bash
cd apps/fumadocs && bun run docs:snapshot 1.2.0
```

The script takes the release version and writes the `1.2` folder. It refuses a pre-release, and it leaves the pages alone when the folder already exists. It labels the copy, adds it to the root `meta.json`, and pins every moving reference in the copy: a repository link and a `raw.githubusercontent.com` download URL take the release tag, and a `FREENARY_VERSION=dev` line takes `1.2`. `docs:check` fails a frozen page that still holds one of these. The `Release` workflow refuses a stable version without its folder. See [Releasing](./releasing.md).

## Where a page goes

Every path is inside a version folder. Each folder's `meta.json` holds the order.

| Path | Reader | What it holds |
| --- | --- | --- |
| `index.mdx` | Everyone | What Freenary is, who it's for, two buttons |
| `get-started/` | Someone with a server and no instance | Before you install, install, connect a bank |
| `use/` | Anyone signed in | What you can do on each screen. No terminal |
| `run/` | The operator, after install | Email, sign-in options, updates and backups, troubleshooting |
| `reference/` | Operators and developers | Every variable, provider detail, alternative setups, the API |
| `contribute.mdx` | Contributors | Clone, run, checks, pull request, links to this folder |

- **One fact lives in one page.** Everywhere else links to it.
- **Internals stay off the site.** Database tables, encryption details, pipeline stages and enum values belong in `docs/engineering/`, not on a user or operator page.
- **No terminal in `use/`.** `docs:check` fails an operator code fence (`bash`, `dotenv`, `yaml` and the like) in `use/`, and warns on an environment variable name there.
- **No page or heading called `Overview`.** Name the subject instead.
- **Describe what the code does now.** No plans or dates. `docs:check` warns on roadmap phrases such as "coming soon".

## Writing rules

- Second person, present tense, active voice. A natural tone: contractions and `-ing` forms are fine.
- Short sentences and short paragraphs. `docs:check` warns on a sentence over 35 words.
- No filler and no sales words: "note that", "it's worth noting", "in summary", "seamless", "robust", "powerful", "simply run" and the like. Delete the phrase, or state the fact it stands in for. `docs:check` warns on each one (`no-filler`), and `FILLER_PHRASES` in `apps/fumadocs/scripts/docs-rules.ts` holds the list.
- Lead with what the reader wants to do, then how. Explain why a step exists in one clause, not a paragraph.
- State the page's purpose in its first two lines.
- One term per concept (see [Terminology](#terminology)). Explain jargon at first use, or avoid it.
- Quote a UI label only when the reader has to find or press it. Never list every label, button, option or count on a screen.
- Every code block is copy-paste correct. Use `freenary.example.com` as the placeholder hostname. Check every command, variable, default and label against the code: `docker-compose.yml`, `deploy/`, `packages/env/src/schema.ts`, `apps/web/messages/en.json`.
- Callouts only for real traps: data loss, security, a bank link that fails.
- End with at most three "Next" cards.
- Target lengths: Get started pages about 120 lines, `use/` and `run/` pages about 150. Reference as long as it needs, but trimmed.

### Terminology

Use exactly these terms, and keep the same one on every page:

| Term | Meaning |
| --- | --- |
| instance | An installed copy of Freenary |
| operator | The person who installs and runs the instance; the first account to sign in |
| setup screen | `/setup`, where the operator enters bank and email credentials |
| your domain, your hostname | For example `freenary.example.com` |
| `FREENARY_URL` | The full `https://` URL of your domain |
| hosting panel | Dokploy, Coolify and similar |
| bank provider | Powens or Enable Banking |
| Powens sandbox | The free Powens test domain |
| bank connection | One link to one bank |
| sync | Fetching new transactions |
| category, custom category, budget line, period | As the app names them |
| assistant | The question box on Home |

Avoid "the stack" (say "Freenary" or "the containers") and "origin" on beginner pages (say "address" or "URL"). `reference/glossary.mdx` holds the reader-facing term list.

## Frontmatter

The schema in `apps/fumadocs/src/shared/content/source.ts` needs three fields:

```md
---
title: Install Freenary
description: One sentence that says what the page covers.
icon: Rocket
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes |  |
| `description` | Yes | One sentence. It feeds the page header, the metadata and search. |
| `icon` | Yes | A canonical lucide name |
| `full` | No | Renders the page at full width |

The build fails a page without one of the three. `docs:check` also fails any other field.

`icon` resolves against the `icons` record of `lucide-react`, which holds canonical PascalCase names only. A deprecated alias such as `AlertCircle` renders nothing; write `CircleAlert`. The build accepts an unknown name silently, `docs:check` fails it. To check one name by hand:

```bash
grep -c "as CircleAlert }" apps/fumadocs/node_modules/lucide-react/dist/esm/icons/index.mjs
```

`1` means the name resolves.

## Components

`apps/fumadocs/src/shared/ui/mdx.tsx` is the whole registry. A tag outside it renders nothing while the build stays green; `docs:check` fails it.

| Component | Notes |
| --- | --- |
| `Callout` | `type` takes `info`, `warn`, `error`, `success` or `idea`. Optional `title`. |
| `Card`, `Cards` | `Card` takes `title`, `href` and `description`. |
| `Steps`, `Step` | A numbered procedure. |
| `Tabs`, `Tab` | One choice per tab. |
| `Files`, `Folder`, `File` | `Folder` takes `name` and `defaultOpen`. `File` takes `name`. |
| `Accordions`, `Accordion` | Detail a reader opens on demand. |
| `TypeTable` | One row per field, with a type and a default. |
| `CodeBlockTabs`, `CodeBlockTabsList`, `CodeBlockTabsTrigger`, `CodeBlockTab` | One command per tab. |

Leave a blank line between an MDX tag and the Markdown inside it:

```mdx
<Tabs items={["Dokploy", "Coolify"]}>

<Tab value="Dokploy">

Text goes here.

</Tab>

<Tab value="Coolify">

Text goes here.

</Tab>

</Tabs>
```

## Code fences

Name a Shiki language on every fence. An unknown language fails the build. The allowed list is in `apps/fumadocs/scripts/docs-rules.ts`: `bash`, `dotenv`, `json`, `jsonc`, `yaml`, `md`, `mdx`, `text`, `ts`, `tsx`, `sql`, `prisma`, `http`, `dockerfile` and `diff`.

`env` isn't a Shiki language. Write `dotenv` for an environment file.

## Links

An internal link is an absolute site path with no extension and no version:

| Target                | Write                  |
| --------------------- | ---------------------- |
| A page                | `/docs/run/email`      |
| A heading on a page   | `/docs/run/email#smtp` |
| A folder's index page | the folder path itself |

`docs:check` resolves every link and `#anchor` against the real page tree. A relative `.mdx` link doesn't work. Link a repository file with its full URL under `https://github.com/suiramdev/freenary/blob/dev/`, the branch that holds the unreleased code; the snapshot pins `dev` to the release tag in a frozen copy.

Some anchors are linked from the app itself, in `apps/web/src/pages/setup/model/labels.ts`. Keep them, or update that file in the same pull request.

## Navigation

A `meta.json` orders the pages of its folder:

```json
{
  "title": "Run your instance",
  "pages": ["email", "sign-in", "updates-and-backups", "troubleshooting"]
}
```

| Field | Effect |
| --- | --- |
| `title` | The folder's name in the sidebar |
| `pages` | The pages, in order |
| `description` | A subtitle for the group |
| `icon` | The folder's icon |
| `defaultOpen` | Opens the group on arrival |
| `root` | Makes the folder the root of its own sidebar. Every version folder sets it. |

Add every new page to `pages`. `docs:check` fails a page the array omits, and an entry with no file.

## What each gate catches

| Mistake | `bun run build` | `bun run docs:check` |
| --- | --- | --- |
| No `title`, `description` or `icon` | Fails | Fails |
| A frontmatter field outside the four | Passes | Fails |
| An unknown code-fence language | Fails | Fails |
| An `icon` lucide doesn't export | Passes, renders nothing | Fails |
| A component the registry omits | Passes, renders nothing | Fails |
| A dead internal link or `#anchor`, or a link that names a version | Passes | Fails |
| A page missing from `meta.json`, or an entry with no page | Passes | Fails |
| A moved page with no pair in `moved-pages.ts` | Passes | Fails |
| A version folder without `"root": true`, or with a stale title | Passes, drops out of the dropdown | Fails |
| A moving reference (`blob/dev`, a `dev` download URL, `FREENARY_VERSION=dev`) in a frozen version | Passes | Fails |
| An operator code fence in `use/` | Passes | Fails |
| An environment variable in `use/`, roadmap language, filler or a sales word (`no-filler`), a sentence over 35 words | Passes | Warns (`next` only) |

Add `--strict` to fail on warnings too. It works only from `apps/fumadocs` (`cd apps/fumadocs && bun run docs:check --strict`); at the root, turbo rejects the flag. `apps/fumadocs/scripts/check-docs.ts` holds the checks, `docs-rules.ts` the lists.

A page that has to quote a banned phrase can switch a rule off for itself:

```mdx
{/* docs-check disable: no-roadmap */}
```

Use it for a page that quotes the rules, never to pass the gate on ordinary prose.

## Before you open the pull request

1. Read the code that owns the behaviour. Quote the real names. Treat the existing page as a claim to check, not a source: verify it against the code, and delete what is wrong or redundant rather than rewording it.
2. Run `bun run docs:check` and `bun run build` in `apps/fumadocs` until both are silent.
3. If you changed `packages/env/src/schema.ts`, run `bun run env:sync`: it regenerates the variable tables in `reference/configuration.mdx`.
4. Open every page you changed with `bun run dev`.
