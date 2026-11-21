---
title: Open a pull request
description: Prepare a branch and a pull request the way this repository expects.
---

This page helps you turn a change into a pull request against `suiramdev/freenary`: which branch to start from, which checks to run, and how to fill in the description.

## Before you start

- A GitHub account and a fork or clone of `https://github.com/suiramdev/freenary`.
- An issue that describes the work. If there is none, open one with an issue form (see step 1).
- The development stack running, as in [Run from source](run-from-source.md).

## Steps

1. If the work has no issue yet, open one at `https://github.com/suiramdev/freenary/issues/new/choose`. Blank issues are turned off, so pick a form:

   - **Bug report**: a problem with Freenary.
   - **Feature request**: an improvement.
   - **Specified task**: work with a complete spec (**Context**, **Expected behavior**, **Acceptance criteria**, **Relevant files**, **Still to define**), ready for someone to build.
   - **Other**: a question, a documentation gap or anything else.

   The `Triage` workflow labels new issues and pull requests with `type:`, `impact:` and `priority:` labels when the repository has its `SUBQ_API_KEY` secret. A maintainer sets the final labels. The triage rules are in <https://github.com/suiramdev/freenary/blob/dev/.github/triage/triage.md>.

2. Start a branch from `dev`, the default branch:

   ```bash
   git fetch origin
   git switch -c fix/login-redirect-loop origin/dev
   ```

3. Make the change. Update the pages under `docs/` that it makes wrong, in the same branch (see [Update the docs](update-the-docs.md)). A change to interface text edits both `apps/web/messages/en.json` and `apps/web/messages/fr.json`.

   Sign off every commit with `-s`. It adds a `Signed-off-by` line that certifies the [Developer Certificate of Origin](https://developercertificate.org). The licensing rules for contributions and dependencies are in [`.github/CONTRIBUTING.md`](https://github.com/suiramdev/freenary/blob/dev/.github/CONTRIBUTING.md#licensing-your-contribution).

   ```bash
   git commit -s -m "fix: stop the login redirect loop"
   ```

4. Run the checks CI runs, as in [Run the checks](run-checks.md):

   ```bash
   bun install --frozen-lockfile
   bun run check
   bun run check-types
   bun run check:fsd
   bun run docs:check
   bun run env:check
   (cd packages/api && bun test)
   bun run build
   ```

5. Push the branch and open the pull request with `dev` as the base:

   ```bash
   git push -u origin fix/login-redirect-loop
   gh pr create --base dev
   ```

6. Fill in every section of the template (`.github/pull_request_template.md`):

   - **Summary**: at most four sentences: what changed, and what a reviewer should look at first.
   - **Motivation**: what problem it solves, and why now.
   - **Drawbacks**: the costs or risks of merging it.
   - **Prior art**: how similar problems were solved elsewhere.
   - **Evidence**: optional, strongly recommended for a change a user can see. Drag screenshots or a screen recording into the box so GitHub hosts them. Use fake data only: no real keys, tokens or personal data, and no file paths from your machine. Delete the section if it does not apply.
   - **Notes**: one line per fact: `Closes #n`; the visual change, or "no visual change"; the tests added; the `docs/` pages updated, or "none" and why; any migration, breaking change or merge-order constraint.

7. Mark the pull request ready for review when it is done. Draft pull requests are skipped by the `Triage` and `OpenBot review` workflows.

8. Resolve every review thread. The `main and dev` ruleset merges a pull request into `dev` only when its `ci` and `compose` checks pass and no review thread is left open.

## Check that it works

The pull request page shows the `CI` workflow with its two jobs, `ci` and `compose`, both passing:

```bash
gh pr checks
```

## If something goes wrong

- The `ci` job fails at a step → run that step's command locally, as listed in [Run the checks](run-checks.md), fix the problem and push again.
- `Documentation` fails with ``stale. Run `bun run docs:generate`.`` → you changed the API, the root `package.json` or a compose file. Run `bun run docs:generate` and commit the result.
- `Environment` fails with ``stale. Run `bun run env:sync`.`` → you changed `packages/env/src/schema.ts`. Run `bun run env:sync` and commit the result.

## Related

- [Code conventions](../../reference/code-conventions.md)
- [Release a version](release-a-version.md)
