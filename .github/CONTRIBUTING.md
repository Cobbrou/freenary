# Contributing to Freenary

The steps live in the documentation:

1. [Run from source](../docs/how-to/contribute/run-from-source.md): get a working development stack.
2. [Code conventions](../docs/reference/code-conventions.md): the rules the checks enforce.
3. [Run the checks](../docs/how-to/contribute/run-checks.md): the same steps as CI.
4. [Update the docs](../docs/how-to/contribute/update-the-docs.md): a change to documented behaviour updates `docs/` in the same pull request.
5. [Open a pull request](../docs/how-to/contribute/open-a-pull-request.md): pull requests target `dev` and use every section of the [pull request template](pull_request_template.md).

Releases are done by maintainers: see [Release a version](../docs/how-to/contribute/release-a-version.md). Do not tag, and do not bump a version unless a maintainer asks.

## Working on an Issue

Anyone can contribute, and you do not need to be a maintainer or ask first to open a pull request for a fix. For an issue that is already open, this is how work is shared.

**Find something to do.** Issues labelled [`good first issue`](https://github.com/suiramdev/freenary/labels/good%20first%20issue) are small and fully specified, a good place to start. Issues labelled [`help wanted`](https://github.com/suiramdev/freenary/labels/help%20wanted) are fully specified and open to anyone. Both labels mean the spec is complete: the issue states the context, the expected behavior, the acceptance criteria and the files to start from. An issue with a **Still to define** list still has open questions, so it carries neither label yet. You can help by proposing an answer in a comment.

**Claim an issue.** Comment on it to say you will take it. A maintainer assigns it to you, usually within a few days. Wait for the assignment before you invest a lot of time, so two people do not build the same thing. Claim one issue at a time while you are new.

**Keep the claim alive.** Open a draft pull request early, or leave a short update when you are stuck. A claim with no pull request and no update for 14 days is stale: a maintainer asks for news, and if there is none, unassigns you and opens the issue to others. That is routine, and you are welcome to claim it again later.

**Open the pull request.** Follow [Open a pull request](../docs/how-to/contribute/open-a-pull-request.md). Write `Closes #n` in the Notes of the pull request, and check each acceptance criterion of the issue before you ask for a review. If the spec turns out to be wrong or incomplete, say so in the issue instead of guessing.

**Report something new.** Use the [issue forms](https://github.com/suiramdev/freenary/issues/new/choose). A maintainer sets the labels, and the `Triage` workflow suggests a type and lists what is missing from the description. If you can specify the work completely, use the **Specified task** form. The triage rules are in [`.github/triage/triage.md`](triage/triage.md).

## Licensing Your Contribution

Freenary is licensed under the [GNU Affero General Public License v3.0 or later](../LICENSE). When you open a pull request, you license your contribution under the same terms, and you confirm that you have the right to do so.

Sign off every commit to state that:

```bash
git commit -s -m "fix: stop the login redirect loop"
```

`-s` appends a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org). Set `git config user.name` and `user.email` to a real name and address first.

Do not paste code from a source whose license forbids it, and do not add a dependency under a license that the AGPL cannot distribute — a proprietary license, or a stronger copyleft such as the SSPL. MIT, ISC, BSD, Apache-2.0 and MPL-2.0 are all fine. A new vendored file that carries its own copyright notice keeps that notice, and the notice goes in [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).
