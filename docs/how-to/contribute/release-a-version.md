---
title: Release a version
description: Publish a tagged release and its images (maintainers only).
---

This page helps a maintainer publish a Freenary release: a `vX.Y.Z` tag, the versioned container images and a GitHub release. The `Release` workflow (`.github/workflows/release.yml`) does all three. Contributors never tag or bump a version.

## Before you start

- Write access to `suiramdev/freenary`, so you can run workflows and push to `main`.
- `dev` holds everything the release ships, and its `CI` workflow passes.
- The version number, without the `v`: `X.Y.Z` for a stable release, or `X.Y.Z-<pre>` (such as `1.3.0-rc.1`) for a prerelease.

## Steps

1. Merge `dev` into `main` through a pull request. The `main and dev` ruleset of the repository refuses a direct push: a change to either branch needs a pull request whose `ci` and `compose` checks pass and whose review threads are resolved.

   ```bash
   gh pr create --base main --head dev --title "Merge dev into main" --body "Release 1.2.0"
   ```

   Merge it once the checks pass. The merge into `main` also runs the `Images` workflow, which publishes the `main` and `sha-<7 characters>` image tags.

2. Run the `Release` workflow from `main`, with the version as input:

   ```bash
   gh workflow run release.yml --ref main -f version=1.2.0
   ```

   You can also open **Actions** → **Release** → **Run workflow** on GitHub, pick `main` and type the version.

3. Follow the run:

   ```bash
   gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```

   The workflow runs three jobs:

   - `tag`: refuses any branch but `main`, a version that is not `X.Y.Z` or `X.Y.Z-<pre>`, and a tag that already exists. It finds the newest existing `v*` tag, then creates and pushes the annotated tag `vX.Y.Z` with the message `Freenary X.Y.Z`.
   - `images`: calls `.github/workflows/images.yml` on the new tag. It builds `freenary-server` and `freenary-web` for `linux/amd64` and `linux/arm64` and pushes them to `ghcr.io/suiramdev/`. A stable version gets the tags `X.Y.Z`, `X.Y`, `X` and `latest`; a prerelease gets `X.Y.Z-<pre>` only. See [Container images](../../reference/images.md).
   - `publish`: creates the GitHub release `Freenary X.Y.Z`. Its notes list both image names and the pull requests merged since the previous tag. A prerelease is marked as a prerelease; a stable version is marked as the latest release.

## Check that it works

```bash
gh release view v1.2.0
docker manifest inspect ghcr.io/suiramdev/freenary-server:1.2.0
```

The release exists, and the manifest lists an `amd64` and an `arm64` image. Its notes start with:

```text
## Images

- `ghcr.io/suiramdev/freenary-server:1.2.0`
- `ghcr.io/suiramdev/freenary-web:1.2.0`
```

## If something goes wrong

The `tag` job stops the run before anything is published:

- `Releases are cut from main, not from <branch>` → run the workflow with `main` selected.
- `Not a version: <input> (expected X.Y.Z or X.Y.Z-pre)` → enter the version without the `v`, such as `1.2.0`.
- `v<version> already exists` → pick the next version number.

If the `images` job fails after the tag is pushed, the tag stays and no GitHub release is created. The `Release tags` ruleset forbids deleting or force-pushing a `v*` tag, so you cannot start again with the same version.

> **TODO (unverified):** how to recover from a failed `images` or `publish` job after the tag exists, such as re-running the failed jobs from the run page.

## Related

- [Container images](../../reference/images.md)
- [Update Freenary](../update-freenary.md)
