import { describe, expect, it } from "bun:test";

import {
  fieldValuesRemovedByOthers,
  issueTypesRemovedByOthers,
  labelsRemovedByOthers,
  lastActor,
  lastFieldActor,
} from "./history";
import type { IssueFieldEvent } from "./history";

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

const fieldEvent = (
  event: Partial<IssueFieldEvent> & Pick<IssueFieldEvent, "kind">
): IssueFieldEvent => ({
  actor: undefined,
  field: "Priority",
  previous: undefined,
  value: undefined,
  ...event,
});

describe("issue field history", () => {
  const fieldEvents = [
    fieldEvent({ actor: BOT, kind: "added", value: "High" }),
    fieldEvent({
      actor: "maintainer",
      kind: "changed",
      previous: "High",
      value: "Low",
    }),
    fieldEvent({ actor: BOT, field: "Impact", kind: "added", value: "Low" }),
    fieldEvent({
      actor: "maintainer",
      field: "Impact",
      kind: "removed",
      previous: "Low",
    }),
    fieldEvent({ actor: BOT, field: "Impact", kind: "added", value: "Medium" }),
    fieldEvent({
      actor: BOT,
      field: "Impact",
      kind: "changed",
      previous: "Medium",
      value: "High",
    }),
  ];

  it("names who last set a field", () => {
    expect(lastFieldActor(fieldEvents, "Priority")).toBe("maintainer");
    expect(lastFieldActor(fieldEvents, "Impact")).toBe(BOT);
    expect(lastFieldActor(fieldEvents, "Effort")).toBeUndefined();
  });

  it("lists the values someone else removed or replaced", () => {
    expect(
      fieldValuesRemovedByOthers(fieldEvents, "Priority", "Low", BOT)
    ).toEqual(["High"]);

    expect(
      fieldValuesRemovedByOthers(fieldEvents, "Impact", "High", BOT)
    ).toEqual(["Low"]);

    expect(
      fieldValuesRemovedByOthers(fieldEvents, "Priority", "High", BOT)
    ).toEqual([]);
  });
});
