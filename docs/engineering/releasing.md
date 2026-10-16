# Release a version

The two long-lived branches, what each push publishes, the Release workflow and its refusals, and the maintainer boundary.

Freenary ships as two container images. A release is maintainer work. A contributor opens a pull request against `dev` and stops there.

## The two branches

| Branch | Role                   | What lands on it                  |
| ------ | ---------------------- | --------------------------------- |
| `dev`  | The integration branch | Every pull request                |
| `main` | The release branch     | `dev`, at the moment of a release |

A normal release takes three moves. A maintainer merges a documentation snapshot into `dev`, merges `dev` into `main`, then runs the `Release` workflow from `main`.

A hotfix goes the other way. The pull request opens against `main`, so the fix carries none of the unreleased work on `dev`. The release runs from `main` as usual. Then `main` merges back into `dev`, or the fix disappears at the next release.

The root `package.json` carries no `version` field, and the repository holds no changelog file. The git tag is the version, and no file repeats it.

## What a push publishes

`.github/workflows/images.yml`, named **Images**, publishes both images to the GitHub Container Registry. The image name comes from the repository slug in lower case, so a fork publishes under its own owner.

| Image                               | Platforms                       |
| ----------------------------------- | ------------------------------- |
| `ghcr.io/suiramdev/freenary-server` | `linux/amd64` and `linux/arm64` |
| `ghcr.io/suiramdev/freenary-web`    | `linux/amd64` and `linux/arm64` |

It runs on two triggers:

- A push to `dev` or `main`. Two path filters skip the run: `apps/fumadocs/**` and `**/*.md`. A documentation-only push therefore builds nothing.
- A `workflow_call` from the `Release` workflow, with the git ref to build as the input.

### The tags

| Ref | Tags on both images |
| --- | --- |
| A push to `dev` | `dev`, and `sha-<first 7 characters of the commit>` |
| A push to `main` | `main`, and `sha-<first 7 characters of the commit>` |
| The tag `vX.Y.Z` | `X.Y.Z`, `X.Y`, `X`, `latest` |
| The tag `vX.Y.Z-<pre>` | `X.Y.Z-<pre>` alone |

A pre-release moves no other tag. It never becomes `latest`, and it never moves `X.Y` or `X`. Any other ref stops the `tags` job with `Unsupported ref: <ref>`.

Only a `vX.Y.Z` git tag writes the `latest` tag. The production compose file defaults `FREENARY_VERSION` to `latest`. [Update an instance](../../apps/fumadocs/content/docs/next/run/updates-and-backups.mdx) is the operator view.

### The three jobs

| Job | Runner | What it does |
| --- | --- | --- |
| `tags` | `ubuntu-latest` | Reads the ref, then derives the version and the tag list |
| `build` | One native runner per platform | Builds one image for one platform and pushes it by digest, with no tag |
| `merge` | `ubuntu-latest` | Joins the digests of one image into one multi-platform manifest, then inspects it |

`build` is a matrix over the two applications and the two platforms. Each platform builds on its own native runner: `ubuntu-latest` for `linux/amd64` and `ubuntu-24.04-arm` for `linux/arm64`. The workflow states the reason: Bun under QEMU emulation is slow and unreliable. The matrix sets `fail-fast: false`, so one broken platform still reports the other three results.

The tags land in `merge`, on the manifest that carries both platforms. That job runs `docker buildx imagetools create` with one tag flag per tag and one reference per digest, then inspects the version tag. The build passes the build argument `GITHUB_REPOSITORY` and the secret `GITHUB_TOKEN`, which the server image needs for the merchant data. [Architecture](./platform.md#what-the-caches-hold) covers that step.

## The `Release` workflow

`.github/workflows/release.yml`, named **Release**, cuts one version. It has one trigger, `workflow_dispatch`, and one input.

| Input | Required | What it holds |
| --- | --- | --- |
| `version` | yes | The version without the `v`, such as `1.2.0` or `1.3.0-rc.1` |

A maintainer runs it by hand:

### 1. Snapshot the documentation

On a branch from `dev`, run `cd apps/fumadocs && bun run docs:snapshot X.Y.Z`, then open a pull request against `dev` and merge it. Make it the last change before the release: a documentation change merged after it reaches `next` alone. A pre-release skips this step, and a patch release finds its folder in place and copies nothing.

### 2. Merge and wait

Merge `dev` into `main`, then wait for CI to pass on `main`.

### 3. Start the workflow

Open the **Actions** tab, pick **Release**, then press **Run workflow**. Select the branch `main`.

### 4. Name the version

Type the version in the `version` field, with no `v`. Press **Run workflow** again.

### The four refusals

The first job, `tag`, stops before it writes anything when one of these holds:

| Refusal | Message |
| --- | --- |
| The run started from a branch other than `main` | `Releases are cut from main, not from <branch>` |
| The version does not match `X.Y.Z` or `X.Y.Z-pre` | `Not a version: <version> (expected X.Y.Z or X.Y.Z-pre)` |
| The tag `v<version>` exists already | `v<version> already exists` |
| A stable version whose folder `apps/fumadocs/content/docs/X.Y` is missing | `<folder> is missing. Run 'cd apps/fumadocs && bun run docs:snapshot <version>' in a pull request to dev, merge it into main, then release.` |

The pre-release suffix accepts digits, letters and dots. A version with a `-` in it is a pre-release.

### What the run produces

| Job | What it does |
| --- | --- |
| `tag` | Pushes the annotated tag `v<version>` on the commit of the run, with the message `Freenary <version>`, as `github-actions[bot]`. It also records the newest earlier `v*` tag for the notes |
| `images` | Calls the `Images` workflow with the ref `refs/tags/v<version>`, which publishes the four version tags |
| `publish` | Creates the GitHub release `v<version>`, titled `Freenary <version>`. The notes open with an **Images** section that names both references and their platforms, then GitHub appends generated notes from the previous tag. The first release has no earlier `v*` tag, so its notes list every merged pull request instead of the generated range. A version with a `-` marks the release as a pre-release |

## The merchant data releases

`.github/workflows/generate-data.yml`, named **Generate merchant data**, publishes a second kind of release: the tag `data-<YYYY-MM-DD>` with the asset `merchant-data.tar.gz`. It passes `--latest=false`, because a data release is a build input and not a version of Freenary. The `Release` workflow passes `--latest` for a stable version, so that release takes the badge. [Transaction categorisation](./categorisation.md#the-weekly-workflow) covers its triggers and its steps.

## The documentation snapshot

The documentation site publishes one copy of the pages for each version. `content/docs/next` holds the pages a pull request edits, and a release freezes them:

| Version | What it holds |
| --- | --- |
| `X.Y` | The pages as they were at the release of `X.Y` |
| `next` | The pages for the unreleased code, which the `dev` and `main` images run |

The snapshot lands through a pull request into `dev`. The `tag` job refuses a stable version whose folder is missing. The `main and dev` ruleset admits no push outside a pull request, so the workflow writes no commit.

The folder therefore freezes when that pull request merges, and the release comes later. A documentation change merged in between reaches `next` and never reaches the frozen folder, and no gate reports it. Snapshot last, and the window stays empty.

The copy pins every moving reference. A repository link names `main`, and the frozen page names the release tag. A download URL names `main`, and the frozen page names the tag. A `FREENARY_VERSION=main` line names the branch, and the frozen page names `X.Y`. Two rules follow:

- A patch release finds `content/docs/X.Y` in place, and copies nothing. A documentation fix for a released version therefore edits that folder directly.
- A pre-release copies nothing. Its readers stay on `next`.

The application links to the documentation for the version it runs. `images.yml` passes the version to the web image as the build argument `FREENARY_VERSION`. The account menu opens `/docs/X.Y` for a release, and `/docs/next` for a branch build. [Writing documentation](./writing-docs.md#versions) holds the authoring rules.

## What a contributor never does

- Never push a git tag. The `tag` job of the `Release` workflow is the one writer of a `v*` tag.
- Never bump a version. The root manifest holds no version field to bump.
- Never open a pull request against `main`, unless it is a hotfix a maintainer asked for.
- Never run the `Release` workflow.

## Related

- [Contributing](../../apps/fumadocs/content/docs/next/contribute.mdx) — The checks CI runs, and what a pull request must carry.
- [Update an instance](../../apps/fumadocs/content/docs/next/run/updates-and-backups.mdx) — How an operator pins a tag, pulls a new version and rolls one back.
- [Architecture](./platform.md) — What each image build produces, and what the caches hold.
