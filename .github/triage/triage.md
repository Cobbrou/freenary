# Triage issues and pull requests

The issue types, issue fields and labels, what the `Triage` workflow does with them, how an issue becomes ready for outside contributors, and how a maintainer works the queue.

The workflow in `.github/workflows/triage.yml` sets the type, the fields and the labels it can justify, and lists what is missing. A maintainer decides everything else. Nothing here replaces a maintainer's judgment: a type, field value or label a maintainer sets always wins.

## Types

An issue's type is its GitHub issue type. A pull request has no type: its title says what kind of change it is, as in `fix: …`, `feat: …`, `docs: …` or `chore: …`.

| Kind of work | Issue type |
| --- | --- |
| Something in Freenary behaves incorrectly | `Bug` |
| A new capability, or an improvement to something that exists | `Feature` |
| The documentation site, README or contributor guides | `Task` and the `documentation` label |
| Dependencies, refactoring, tooling, tests or chores | `Task` |

The repository is owned by a user account, so it has only the three default issue types. The `documentation` label separates documentation work from the other tasks. The **Bug report** form sets `Bug` and the **Feature request** form sets `Feature`.

## The fields

Impact and priority are GitHub issue fields, not labels. Each is a single-select field with the options `High`, `Medium` and `Low`, pinned to every issue type and to issues without a type, and visible to everyone who can see the issue. A pull request has no fields.

The fields belong to the repository owner's account, under **Settings → Planning → Issue fields**, so every repository of the account shares them. The workflow finds them by name: `Impact` and `Priority`, as `ISSUE_FIELDS` in `scripts/triage/taxonomy.ts` names them. When a field is missing, the workflow leaves it unset and logs a warning.

### Impact

| Value | A reader would say |
| --- | --- |
| `High` | A main flow breaks for many users with no workaround, or data, balances or credentials are at risk |
| `Medium` | A feature degrades for some users, and a workaround exists |
| `Low` | Cosmetic, or very few users are affected |

### Priority

| Value    | Meaning                                          |
| -------- | ------------------------------------------------ |
| `High`   | Work on it first. It belongs to the next release |
| `Medium` | Normal. It belongs to an upcoming release        |
| `Low`    | Nice to have. No deadline                        |

Impact describes the problem, priority schedules the fix. They often agree, and a maintainer may set them apart: a low-impact bug that blocks a release can have Priority `High`.

## The labels

The repository carries three labels, defined in `scripts/triage/taxonomy.ts`. The `Labels` workflow creates and updates them when that file changes on `dev` or `main`; it never deletes one.

| Group | Labels | Meaning |
| --- | --- | --- |
| Documentation | `documentation` | A `Task` issue about documentation |
| Contribution | `good first issue`, `help wanted` | Open to a newcomer, or open to any outside contributor |

There is no status label, no area label and no label for a duplicate, a question or a reason to close. The state of an item is whether it is open, assigned and linked to a pull request.

## What the workflow does

The `Triage` workflow reads the title, the description and the author's replies when an issue or pull request is opened, reopened, edited or answered. It skips closed items, draft pull requests and anything a bot triggered. The rules:

- **Type, on issues only.** It sets its most probable answer as the issue type, whatever its confidence, because a wrong type costs a change and no wrong decision, and adds `documentation` for documentation work. With no usable answer, it sets none. It never changes a type that is already set.
- **Impact and priority, on issues only.** It sets the Impact field to the model's most probable level, whatever its confidence, and gives an exact tie to the higher level. When the model returns no probability per level, it rounds the impact score. Priority follows impact: an Impact of `High`, `Medium` or `Low` gives the same Priority. A regression, found with at least 0.80 probability, raises that priority by one level. A security risk, found with the same probability, gives Priority `High`. Neither sets a priority without an impact. With no usable impact answer, neither field is set. An item with no impact and no priority is waiting for a maintainer.
- **`good first issue`, on issues only.** It applies the label when the model's most probable answer, whatever its confidence, is that a newcomer could finish the work, and only when the spec is complete: no gap in the checklist below, no open item under **Still to define**, not blocked. When the spec stops being complete, the workflow removes the `good first issue` label it applied. A later answer that a newcomer could not finish it does not remove it. While an item is open under **Still to define**, it also removes `good first issue` and `help wanted` whoever added them, and adds a gap for a maintainer.
- **Possible duplicate.** When the model's most probable answer names another open item with at least 0.85 probability, it asks a maintainer to check it. It adds no label, and an exact tie goes to no duplicate.
- **`help wanted`.** The workflow never applies it. A maintainer adds it when the spec is complete and the work is open to anyone.
- **Never over a maintainer.** It does not replace a type or a field value a maintainer already set. It never sets back an issue type or a field value that someone else removed or replaced, and never adds back a label that someone else removed. It recomputes Priority only when it set the current value itself, and clears that value when no impact supports it anymore.

A pull request gets no field and no label: its type is in its title, and impact, priority and the contribution labels belong to the issue it closes.

### The checklist

An issue is ready when its spec is complete. The workflow checks the criteria for its type:

- A bug needs the steps that show it, what happened and what you expected, and the version or deployment.
- A feature needs the problem, the expected result, and no open design choice.
- A documentation issue, a `Task` with the `documentation` label, needs the page and what is wrong on it.
- Any other `Task` is maintenance, and needs what should change and why, and no open design choice.
- A pull request needs a written Summary, every section of the template filled except the optional Evidence, and passing `ci` and `compose` checks. When it changes documented behaviour and no page under `docs/`, its Notes name the pages or say why none needed a change.

When something is missing, the workflow posts one comment that lists it for the author and for a maintainer, updates it when the list changes, and deletes it when nothing is missing or the item is blocked. A Priority set by a maintainer also closes the comment, unless an item is still open under **Still to define**.

Setting the issue type, setting the Impact or Priority field, or adding the `documentation`, `good first issue` or `help wanted` label runs the workflow again.

## Complete specs

An issue exists to be built. Create it when its spec is complete: the [spec template](../../.github/ISSUE_TEMPLATE/spec.yml) asks for the context, the expected behavior, the acceptance criteria and the files to start from.

When you cannot complete the spec yet, you may still create the issue. Add a **Still to define** section and list what is open as a checklist:

```md
### Still to define

- [ ] Whether the export covers closed accounts
- [ ] The file format: CSV only, or CSV and OFX
```

Rules for an issue with an open item:

- It does not carry `good first issue` or `help wanted` until every item is ticked or the section is empty. The workflow withholds the first and removes both while an item is open, and a maintainer does not add either.
- Settling an item means ticking it, or removing it and updating the spec above. Do both in the description, so the workflow runs again.
- A maintainer owns the list, so the workflow lists it as a gap for a maintainer. Anyone may propose an answer in a comment.

## Work the queue

A maintainer goes through new items in this order:

1. **Read the gap comment**, if there is one, and answer what is addressed to a maintainer.
2. **Confirm the type.** Change the issue type, or the `documentation` label, if the workflow was wrong.
3. **Set the Impact and Priority fields** when the workflow set none. Use the tables above, and leave both empty when the item is not understood well enough to judge.
4. **Check the spec.** When it is complete and a newcomer could take it, add `good first issue`; when anyone could take it, add `help wanted`. When it is not complete, move the open questions under **Still to define**.
5. **Link duplicates** with a comment that names the original, then close the duplicate as such. There is no label for it.

A maintainer is the only one who closes an issue for a reason other than a merged pull request.

## Claims

An issue is claimed in a comment and assigned by a maintainer. [`.github/CONTRIBUTING.md`](../CONTRIBUTING.md#working-on-an-issue) holds the contributor's side. The maintainer's side:

- Assign the issue to the first contributor who comments that they will take it, unless it is not open to outside contributors.
- A claim is stale after 14 days with no pull request, no draft pull request and no update. Ask for an update in a comment. When there is none, unassign and say the issue is open again. A new claim may then be assigned.
- A claim never blocks a maintainer from doing the work.

## Change the labels or fields

Edit `scripts/triage/taxonomy.ts`, `plan.ts` and the tests together. `ISSUE_TYPES` in `taxonomy.ts` maps each type to an issue type, `ISSUE_FIELDS` names the issue fields and `LEVELS` lists their options. Update this page and the contributor pages under `docs/how-to/contribute/` in the same pull request. Merging the change creates or updates the labels; deleting a label is a manual step in the repository settings. The workflow never creates, renames or deletes an issue field: change the fields and their options in the account settings first, with the names the code expects.
