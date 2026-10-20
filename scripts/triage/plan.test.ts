import { describe, expect, it } from "bun:test";

import { areasForPaths } from "./areas";
import {
  derivePriority,
  MIN_GOOD_FIRST_ISSUE_PROBABILITY,
  MIN_SIGNAL_PROBABILITY,
  planLabels,
} from "./plan";
import type { PlanInput } from "./plan";
import { buildQuestions } from "./questions";
import type { Answers } from "./subq";
import { LABELS } from "./taxonomy";

const confidentBug: Answers = {
  area: { choice: "frontend", confidence: 0.9, type: "choice" },
  blocked: { noul: 0.05, type: "noul" },
  check_environment: { noul: 0.9, type: "noul" },
  check_expected_actual: { noul: 0.9, type: "noul" },
  check_steps: { noul: 0.9, type: "noul" },
  impact: { confidence: 0.8, score: 2.2, type: "score" },
  regression: { noul: 0.95, type: "noul" },
  security: { noul: 0.2, type: "noul" },
  type: { choice: "bug", confidence: 0.95, type: "choice" },
};

const planFor = (overrides: Partial<PlanInput>) =>
  planLabels({
    answers: confidentBug,
    areasFromPaths: [],
    checklist: "bug",
    docsExpected: false,
    existingLabels: [],
    kind: "issue",
    refusedLabels: [],
    ruleGaps: [],
    workflowPriorities: [],
    workflowReproduction: false,
    workflowStatuses: [],
    ...overrides,
  });

describe("planLabels", () => {
  it("labels every group of a confident answer set", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: [],
      workflowStatuses: [],
    });

    expect(plan.labels.toSorted()).toEqual(
      [
        "area:frontend",
        "impact:high",
        "priority:p1",
        "regression",
        "status:ready",
        "type:bug",
      ].toSorted()
    );
  });

  it("holds a low-confidence group back and marks the item for triage", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: [],
      workflowStatuses: [],
    });

    expect(plan.labels).not.toContain("type:bug");
    expect(plan.labels).toContain("status:needs-triage");
  });

  it("never overrides a group a maintainer already labelled", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["type:feature", "status:blocked"],
      workflowStatuses: [],
    });

    expect(plan.labels).not.toContain("type:bug");
    expect(plan.labels.some((label) => label.startsWith("status:"))).toBe(
      false
    );
  });

  it("prefers the areas of changed files over the model", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: ["database", "docs"],
      existingLabels: [],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("area:database");
    expect(plan.labels).toContain("area:docs");
    expect(plan.labels).not.toContain("area:frontend");
  });

  it("flags a confident duplicate", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: { choice: "item-14", confidence: 0.9, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: [],
      workflowStatuses: [],
    });

    expect(plan.duplicateOf).toBe(14);
    expect(plan.labels).toContain("duplicate");
  });

  it("puts needs-reproduction on a bug with no steps", () => {
    const noSteps: Answers = {
      ...confidentBug,
      check_steps: { noul: 0.2, type: "noul" },
    };

    expect(planFor({ answers: noSteps }).labels).toContain(
      "needs-reproduction"
    );

    expect(
      planFor({ answers: noSteps, checklist: "request" }).labels
    ).not.toContain("needs-reproduction");
  });

  it("counts a group a maintainer labelled as settled", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: ["type:feature"],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("status:ready");
  });
});

describe("areasForPaths", () => {
  it("maps repository paths to areas", () => {
    expect(
      areasForPaths([
        "apps/web/src/pages/budget/ui/page.tsx",
        "packages/api/src/routers/budget.ts",
        "packages/db/prisma/schema.prisma",
        ".github/workflows/ci.yml",
        "apps/fumadocs/content/docs/next/index.mdx",
        "README.md",
      ])
    ).toEqual(["api", "ci-cd", "database", "docs", "frontend"]);
  });
});

describe("buildQuestions", () => {
  it("stays within the sixteen questions a request allows", () => {
    const questions = buildQuestions("issue", [{ number: 3, title: "x" }]);

    expect(Object.keys(questions).length).toBeLessThanOrEqual(16);
  });

  it("asks pull requests about their description, not newcomers", () => {
    const questions = buildQuestions("pull-request", []);

    expect(questions.good_first_issue).toBeUndefined();
    expect(questions.pr_summary).toBeDefined();
    expect(questions.pr_docs).toBeDefined();
  });
});

describe("taxonomy", () => {
  it("defines every label once", () => {
    const names = LABELS.map((label) => label.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(33);
  });
});

const goodFirstIssueLabelsAt = (noul: number) =>
  planFor({
    answers: { ...confidentBug, good_first_issue: { noul, type: "noul" } },
    areasFromPaths: [],
    existingLabels: [],
    workflowStatuses: [],
  }).labels;

describe("good-first-issue", () => {
  it("needs a stricter probability than the other signals", () => {
    expect(goodFirstIssueLabelsAt(MIN_SIGNAL_PROBABILITY)).not.toContain(
      "good-first-issue"
    );

    expect(
      goodFirstIssueLabelsAt(MIN_GOOD_FIRST_ISSUE_PROBABILITY - 0.01)
    ).not.toContain("good-first-issue");

    expect(goodFirstIssueLabelsAt(MIN_GOOD_FIRST_ISSUE_PROBABILITY)).toContain(
      "good-first-issue"
    );
  });
});

describe("derivePriority", () => {
  it("maps impact to priority", () => {
    expect(derivePriority("impact:critical", [])).toBe("priority:p0");
    expect(derivePriority("impact:high", [])).toBe("priority:p1");
    expect(derivePriority("impact:medium", [])).toBe("priority:p2");
    expect(derivePriority("impact:low", [])).toBe("priority:p3");
    expect(derivePriority(undefined, [])).toBeUndefined();
  });

  it("raises priority for security and regressions, not breaking changes", () => {
    expect(derivePriority("impact:low", ["security"])).toBe("priority:p0");
    expect(derivePriority(undefined, ["regression"])).toBe("priority:p1");
    expect(derivePriority("impact:low", ["breaking-change"])).toBe(
      "priority:p3"
    );

    expect(derivePriority("impact:critical", ["regression"])).toBe(
      "priority:p0"
    );
  });
});

describe("planLabels priority", () => {
  const lowConfidenceImpact: Answers = {
    ...confidentBug,
    impact: { confidence: 0.3, score: 0, type: "score" },
    regression: { noul: 0.1, type: "noul" },
  };

  it("derives priority from an impact label a maintainer set", () => {
    const plan = planFor({
      answers: lowConfidenceImpact,
      areasFromPaths: [],
      existingLabels: ["impact:critical"],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("priority:p0");
  });

  it("derives priority from an existing security label", () => {
    const plan = planFor({
      answers: lowConfidenceImpact,
      areasFromPaths: [],
      existingLabels: ["security"],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("priority:p0");
  });

  it("keeps a priority a maintainer set", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["priority:p3"],
      workflowStatuses: [],
    });

    expect(plan.labels.some((label) => label.startsWith("priority:"))).toBe(
      false
    );
  });

  it("maps a maintainer impact without a regression", () => {
    const plan = planFor({
      answers: { ...confidentBug, regression: { noul: 0.1, type: "noul" } },
      areasFromPaths: [],
      existingLabels: ["impact:low"],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("priority:p3");
  });

  it("derives priority from an existing regression label", () => {
    const plan = planFor({
      answers: lowConfidenceImpact,
      areasFromPaths: [],
      existingLabels: ["regression"],
      workflowStatuses: [],
    });

    expect(plan.labels).toContain("priority:p1");
  });
});

describe("workflow status", () => {
  it("replaces a status the workflow set when the answer changes", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["status:needs-triage"],
      workflowStatuses: ["status:needs-triage"],
    });

    expect(plan.labels).toContain("status:ready");
    expect(plan.removed).toEqual(["status:needs-triage"]);
  });

  it("keeps a status the workflow set when the answer is the same", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["status:ready"],
      workflowStatuses: ["status:ready"],
    });

    expect(plan.labels).not.toContain("status:ready");
    expect(plan.removed).toEqual([]);
  });

  it("never replaces a status a maintainer set", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["status:blocked"],
      workflowStatuses: [],
    });

    expect(plan.removed).toEqual([]);
    expect(plan.labels.some((label) => label.startsWith("status:"))).toBe(
      false
    );
  });

  it("removes its own status once a maintainer sets one", () => {
    for (const existingLabels of [
      ["status:needs-triage", "status:blocked"],
      ["status:blocked", "status:needs-triage"],
    ]) {
      const plan = planFor({
        answers: confidentBug,
        areasFromPaths: [],
        existingLabels,
        workflowStatuses: ["status:needs-triage"],
      });

      expect(plan.removed).toEqual(["status:needs-triage"]);
      expect(plan.labels.some((label) => label.startsWith("status:"))).toBe(
        false
      );
    }
  });

  it("removes every extra status it owns", () => {
    const plan = planFor({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["status:needs-info", "status:needs-triage"],
      workflowStatuses: ["status:needs-info", "status:needs-triage"],
    });

    expect(plan.labels).toContain("status:ready");
    expect(plan.removed.toSorted()).toEqual([
      "status:needs-info",
      "status:needs-triage",
    ]);
  });

  it("downgrades a workflow ready status on a low-confidence answer", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: ["status:ready"],
      workflowStatuses: ["status:ready"],
    });

    expect(plan.labels).toContain("status:needs-triage");
    expect(plan.removed).toEqual(["status:ready"]);
  });
});

describe("workflow priority", () => {
  it("recomputes its own priority after a maintainer changes impact", () => {
    const plan = planFor({
      answers: { ...confidentBug, regression: { noul: 0.1, type: "noul" } },
      existingLabels: ["impact:critical", "priority:p3", "status:ready"],
      workflowPriorities: ["priority:p3"],
    });

    expect(plan.labels).toContain("priority:p0");
    expect(plan.removed).toContain("priority:p3");
  });

  it("removes its own priority once a maintainer sets one", () => {
    const plan = planFor({
      existingLabels: ["priority:p3", "priority:p1"],
      workflowPriorities: ["priority:p3"],
    });

    expect(plan.removed).toContain("priority:p3");
    expect(plan.labels.some((label) => label.startsWith("priority:"))).toBe(
      false
    );
  });
});
