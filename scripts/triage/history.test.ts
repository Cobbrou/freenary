import { describe, expect, it } from "bun:test";

import {
  issueTypesRemovedByOthers,
  labelsRemovedByOthers,
  lastActor,
} from "./history";

const BOT = "github-actions[bot]";

const events = [
  {
    actor: { login: BOT },
    event: "labeled",
    label: { name: "good first issue" },
  },
  {
    actor: { login: "maintainer" },
    event: "unlabeled",
    label: { name: "good first issue" },
  },
  { actor: { login: BOT }, event: "labeled", label: { name: "type: bug" } },
  {
    actor: { login: BOT },
    event: "labeled",
    label: { name: "priority: low" },
  },
  {
    actor: { login: BOT },
    event: "unlabeled",
    label: { name: "priority: low" },
  },
  {
    actor: { login: "maintainer" },
    event: "labeled",
    label: { name: "type: bug" },
  },
  { actor: { login: BOT }, event: "labeled", label: { name: "impact: low" } },
];

describe("lastActor", () => {
  it("reads the newest matching event", () => {
    expect(lastActor(events, "labeled", "type: bug")).toBe("maintainer");
    expect(lastActor(events, "labeled", "missing")).toBeUndefined();
  });
});

describe("labelsRemovedByOthers", () => {
  it("lists labels someone else removed and nobody added back", () => {
    expect(
      labelsRemovedByOthers(events, ["type: bug", "impact: low"], BOT)
    ).toEqual(["good first issue"]);
  });
});

describe("issueTypesRemovedByOthers", () => {
  it("lists the types someone else removed or replaced", () => {
    const typeEvents = [
      { actor: { login: BOT }, event: "issue_type_added" },
      {
        actor: { login: "maintainer" },
        event: "issue_type_changed",
        prev_issue_type: { name: "Bug" },
      },
      {
        actor: { login: "maintainer" },
        event: "issue_type_removed",
        prev_issue_type: { name: "Feature" },
      },
      {
        actor: { login: BOT },
        event: "issue_type_removed",
        prev_issue_type: { name: "Task" },
      },
      { actor: { login: "maintainer" }, event: "labeled" },
    ];

    expect(issueTypesRemovedByOthers(typeEvents, undefined, BOT)).toEqual([
      "Bug",
      "Feature",
    ]);

    expect(issueTypesRemovedByOthers(typeEvents, "Bug", BOT)).toEqual([
      "Feature",
    ]);
  });
});
