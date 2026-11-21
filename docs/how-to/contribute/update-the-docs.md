---
title: Update the docs
description: Edit a page, regenerate the reference pages and preview the site.
---

This page helps you change the documentation: the Markdown files under `docs/`, which the documentation site in `apps/fumadocs` renders. A change that alters documented behavior updates the pages in the same pull request.

## Before you start

- A working clone, as in [Run from source](run-from-source.md).
- Know which page type you are writing. The site follows [Diátaxis](https://diataxis.fr), one type per page:
  - `docs/tutorials/`: a first path through Freenary, start to finish.
  - `docs/how-to/`: steps for one task, for a reader who already runs Freenary. `docs/how-to/contribute/` holds the contributor tasks.
  - `docs/reference/`: facts only, no steps.
  - `docs/explanation/`: how something works, from the code, with no steps.

## Steps

1. Create or open the `.md` file in the right folder. Start it with exactly two frontmatter keys:

   ```yaml
   ---
   title: Configure email
   description: One plain sentence that says what the page helps you do.
   ---
   ```

   Do not write an H1 in the body: the title comes from the frontmatter. Start with one or two sentences that say what the page helps you do, then use H2 sections.

2. For a how-to page, use these sections in order: `## Before you start` (bulleted prerequisites), `## Steps` (numbered, one action per step, exact commands), `## Check that it works` (a command and its expected output, or the exact text on screen), `## If something goes wrong` (symptom → cause → fix), and optionally `## Related`.

3. Follow the writing rules:

   - Plain GitHub-flavoured Markdown. No MDX, no JSX, no raw HTML.
   - Plain words, second person, present tense, short sentences. No marketing and no filler words such as "simply", "just", "easily" or "seamlessly". Explain each term the first time you use it.
   - The code is the source of truth. Quote real names: variables from `packages/env/src/schema.ts`, log lines and error texts from the code, and interface labels in **bold**, copied from `apps/web/messages/en.json`. Never invent a behavior or a reason.
   - Mark anything you could not check, such as a third-party console, with a line `> **TODO (unverified):** <what needs checking>`.
   - Fence code with one of `bash`, `sh`, `dotenv`, `yaml`, `json`, `text`, `ts`, `tsx`, `ini`, `diff`, `sql` or `nginx`.
   - Link other pages with relative paths to the `.md` file, such as `../../reference/configuration.md#email` from a page in `docs/how-to/contribute/`. Never link a versioned URL such as `/docs/next/…`.
   - Do not copy the configuration tables. Show the few lines a reader needs and link to the section of [Configuration](../../reference/configuration.md).
   - A fact lives in one page; other pages link to it.
   - Put screenshots in `docs/images/` and show them with a relative image link and alt text that says what the screen shows, such as `![The Bank provider page with Powens selected](../images/03-setup-bank-provider.png)`. Take them from a local stack with fake data only (no real names, keys or bank data, and no browser extensions in the frame), and crop them to the part of the screen the step is about. `bun run docs:check` refuses an image with no alt text, one outside `docs/images/`, and an image no page shows. The site bundles the image; the Markdown version of a page links it on GitHub.

4. List a new page in the `meta.json` of its folder. `pages` sets the order of the sidebar; an entry is a file name without `.md`, or a subfolder name. A `"---Label---"` entry is a separator with a label:

   ```json
   {
     "title": "How-to guides",
     "pages": ["---Configure---", "configure-powens", "configure-email"]
   }
   ```

   Every page and subfolder must be listed exactly once.

5. Add the page to `docs/llms.txt`, the index for language models, under the right `## ` section, as one list item: a Markdown link whose text is the page title and whose target is the page path relative to `docs/` (such as `how-to/configure-email.md`), then a colon and a short note. The file starts with a `# ` heading with the project name, then a `> ` summary line before the first section.

6. If you moved or renamed a page, add the old path to `MOVED_PAGES` in `apps/fumadocs/src/shared/config/moved-pages.ts`, mapped to the new file path without `.md`:

   ```ts
   "contributing/local-stack": "how-to/contribute/run-from-source",
   ```

   The site then redirects `/docs/contributing/local-stack` to the new page.

7. Regenerate the reference pages that come from code. Do not edit them by hand:

   ```bash
   bun run docs:generate
   bun run env:sync
   ```

   `docs:generate` (`scripts/docs-reference.ts`) writes `docs/reference/openapi.json`, `api.md`, `commands.md` and `compose-files.md` from the API router, the server entry, the root `package.json` and the compose files. `env:sync` writes `docs/reference/configuration.md` and `.env.example` from the env schema (see [Add an environment variable](add-an-environment-variable.md)).

8. Check the pages:

   ```bash
   bun run docs:check
   ```

9. Preview the site:

   ```bash
   cd apps/fumadocs && bun run dev
   ```

   Open `http://localhost:4000/docs/` followed by the page path without `.md`, for example `http://localhost:4000/docs/how-to/contribute/update-the-docs`. On the Docker development stack the `docs` service serves the same site at `docs.<slug>.freenary.<domain>`.

## Check that it works

`bun run docs:check` ends with:

```text
docs-reference: 4 generated files current
docs-check: <n> pages, no problems
```

It also prints one `docs-check: info:` line per page that still has unverified markers, with their count. These lines are not failures.

## If something goes wrong

`bun run docs:check` prints each problem as `docs-check: <file>:<line>: <message>` and exits with status 1:

- `no frontmatter; open the page with title and description.` or `the frontmatter must hold exactly a non-empty title and description` → fix the frontmatter: two keys, both filled.
- `H1 "…" in the body; the title comes from the frontmatter, so start sections at H2.` → turn the H1 into an H2 or remove it.
- `… the page is a stub.` → the page still holds the placeholder text of an unwritten page. Write the page.
- `code fence language "…" is not one of …` → use a listed language.
- `link …: the target … does not exist.` or `no heading in … has the slug #…` → fix the path or the anchor.
- `the link … names a docs version; link the .md file relatively.` → use a relative `.md` link.
- `the entry "…" is neither a page nor a subfolder.` or `"…" is listed 0 times; list it exactly once.` → fix the folder's `meta.json`.
- ``docs-reference: <file>: stale. Run `bun run docs:generate`.`` → run `bun run docs:generate`.

## Related

- [Run the checks](run-checks.md)
