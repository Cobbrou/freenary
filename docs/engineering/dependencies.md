# Dependency updates

How Renovate opens dependency pull requests, what it automerges, and why the Bun catalog needs a second job.

Renovate keeps the dependencies of this repository current. It reads `renovate.json5` at the root, and it opens every pull request against `dev`.

> [!WARNING] Renovate reads that file from the **default branch** alone. `useBaseBranchConfig` defaults to `none`, so a change to `renovate.json5` on `dev` changes nothing until `main` carries it. The same holds for the `workflow_dispatch` trigger of `ci.yml`. Both reach `main` at the next release. Before that, Renovate runs on its own defaults.

## What it watches

Six managers cover the repository.

| Manager | What it covers |
| --- | --- |
| `bun` | Every `package.json` and `bun.lock`, plus the `packageManager` field |
| `regex` | The 20 shared versions in `workspaces.catalog` of the root `package.json` |
| `github-actions` | The actions each workflow calls |
| `dockerfile` | The `oven/bun` base images, and the `docker/dockerfile` syntax line of `apps/server/Dockerfile` |
| `docker-compose` | `postgres` and `axllent/mailpit` |
| `nvm` | The Node version in `.nvmrc` |

Two images stay out of reach. Freenary publishes `ghcr.io/suiramdev/freenary-server` and `ghcr.io/suiramdev/freenary-web` itself, and both compose entries name a `FREENARY_VERSION` variable that Renovate skips on its own. `renovate.json5` also disables the two names, which holds if either one ever takes a literal tag.

Check the file itself after you change it:

```bash
npx --yes --package renovate@latest renovate-config-validator renovate.json5
```

## The schedule and the merge rules

| Rule | Value |
| --- | --- |
| Branch every pull request targets | `dev` |
| When Renovate runs | Before 6am on Monday, Europe/Paris |
| Age a release must reach first | 3 days |
| Open pull requests at once | 10 |
| Automerge | Patch, minor, pin and digest, after the `ci` and `compose` checks pass |
| Review by hand | Every major update, and every package pinned to a prerelease |
| Lock file maintenance | Before 6am on the first day of the month |

A security advisory ignores the schedule and the three-day wait. Those pull requests carry the `security` label.

> [!WARNING] CI runs no tests, so a green `ci` check proves that the repository compiles, not that it works. Automerge rests on the build and on the three-day wait alone. Read the dependency dashboard each week.

A package pinned to a prerelease never automerges. `effect` sits at `4.0.0-rc.115`, and Renovate reads `rc.115` to `rc.116` as a patch. The update type alone would let an unstable version of a core library into `dev`.

A PostgreSQL major update opens no pull request. Such a major needs a dump and a restore of the database. It waits for your approval on the dependency dashboard first.

## The dependency dashboard

Renovate keeps one open issue titled **Dependency Dashboard**. It lists every update it holds back, every pull request it opened, and every failure. Tick a box there to ask for a branch at once.

## The Bun catalog needs a second job

The root `package.json` holds a `workspaces.catalog` block. It pins one version for each of the 20 packages that more than one workspace depends on. Each workspace then writes `catalog:` in place of a range.

Renovate reads a catalog for pnpm and for yarn, and it reads no catalog for Bun. Without help, those 20 versions stay frozen. `renovate.json5` therefore declares a regex custom manager. It matches the block, then each entry inside it. Such a manager writes no lock file. A catalog pull request lands with a stale `bun.lock`, and step 1 of CI fails:

```text
error: lockfile had changes, but lockfile is frozen
note: the catalog in package.json changed since bun.lock was saved
```

`.github/workflows/renovate-lockfile.yml` closes that gap. On every push to a `renovate/**` branch it runs one command, and it commits the result when the file moved:

```bash
bun install --lockfile-only --ignore-scripts
```

The job then calls `gh workflow run ci.yml`. A push made with `GITHUB_TOKEN` starts no workflow. GitHub exempts the two dispatch events from that rule, and `ci.yml` declares `workflow_dispatch` for this one caller. Pull requests from this manager carry the `catalog` label.

> [!WARNING] GitHub reads the `workflow_dispatch` trigger from the default branch. The call above answers 422 until `main` carries it, which happens at the next release. Until then, a catalog pull request keeps its lock file commit but starts no CI run. Start the **CI** workflow by hand on that branch, and the job log says the same.

> [!WARNING] Delete the custom manager, this workflow, and the `workflow_dispatch` trigger of `ci.yml` on the day Renovate gains Bun catalog support. Until then the catalog has two readers, and a change to the block shape can break the second one.

## What a reviewer does with these pull requests

- Read the release notes Renovate puts in the body. It links the diff and the changelog of each version.
- A major update names its breaking changes. Run the stack and the checks of [Contributing](../../apps/fumadocs/content/docs/next/contribute.mdx) before you merge one.
- A red `ci` check has ordinary causes: a type error or a broken build from the new version. On a catalog branch, read the **Renovate lockfile** job first, because a missing lock file commit fails step 1.
- Never push to a Renovate branch by hand. Renovate rebases it, and your commit disappears.

## Enable it on a fork

### 1. Install the app

Install the [Renovate GitHub App](https://github.com/apps/renovate) on the fork, and grant it access to the repository.

### 2. Turn on automerge

Open **Settings → General** and turn on **Allow auto-merge**. Renovate then hands each merge to GitHub. Add a ruleset on your own `dev` branch that needs the `ci` and `compose` checks. Without one, GitHub merges with nothing to wait for.

### 3. Answer the onboarding pull request

Renovate opens one pull request that names the updates it found. Merge it, and Renovate starts on the schedule above.
