# Triage Labels

The skills speak in terms of five canonical triage roles. This repo no longer uses status labels, so this file maps each role to what the tracker does instead. The label set and the rules behind it are in [`triage.md`](triage.md).

| Role in mattpocock/skills | In our tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | No label. An issue with no `impact:` and no `priority:` label | A maintainer needs to evaluate this issue |
| `needs-info` | No label. The `Triage` workflow's gap comment lists what the author owes | Waiting on the reporter for more information |
| `ready-for-agent` | `help wanted`, or an assignee. The spec is complete: nothing under **Still to define** | Fully specified and ready for work. The tracker does not separate agent work from human work |
| `ready-for-human` | Same as `ready-for-agent` | Same as `ready-for-agent` |
| `wontfix` | No label. Close the issue with a comment that says why | Will not be actioned |

Issues carry a GitHub issue type: `Bug`, `Feature` or `Task`. A documentation `Task` also carries the `documentation` label. Pull requests carry no type: their title says what kind of change they are.

The labels this repo uses are `documentation`, `impact: high`, `impact: medium`, `impact: low`, `priority: high`, `priority: medium`, `priority: low`, `good first issue` and `help wanted`. A skill that mentions another label has no counterpart here: skip that step.

`good first issue` and `help wanted` mean the spec is complete. Never apply either while the issue has an open item under **Still to define**.
