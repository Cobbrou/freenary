import { describe, expect, it } from "bun:test";

import {
  DOCUMENTATION_LABEL,
  fieldValuesOf,
  ISSUE_TYPES,
  typeOfIssue,
  typesOfIssueType,
} from "./taxonomy";

describe("issue types", () => {
  it("files documentation and maintenance under Task", () => {
    expect(ISSUE_TYPES).toEqual({
      bug: "Bug",
      documentation: "Task",
      feature: "Feature",
      maintenance: "Task",
    });

    expect(typesOfIssueType("Task")).toEqual(["documentation", "maintenance"]);
    expect(typesOfIssueType("Epic")).toEqual([]);
  });

  it("reads a Task as documentation only with the documentation label", () => {
    expect(typeOfIssue("Bug", [])).toBe("bug");
    expect(typeOfIssue("Task", [])).toBe("maintenance");
    expect(typeOfIssue("Task", [DOCUMENTATION_LABEL])).toBe("documentation");
    expect(typeOfIssue(undefined, [DOCUMENTATION_LABEL])).toBeUndefined();
    expect(typeOfIssue("Epic", [])).toBeUndefined();
  });
});

describe("issue fields", () => {
  it("reads the Impact and Priority levels and ignores the rest", () => {
    expect(
      fieldValuesOf([
        { name: "Impact", value: "High" },
        { name: "Priority", value: "Low" },
        { name: "Effort", value: "High" },
      ])
    ).toEqual({ impact: "High", priority: "Low" });

    expect(
      fieldValuesOf([
        { name: "Priority", value: "Urgent" },
        { name: "Impact", value: undefined },
      ])
    ).toEqual({});
  });
});
