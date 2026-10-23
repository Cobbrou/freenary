import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Effect } from "effect";

import { areasForPaths } from "./areas";
import { renderGapComment } from "./comment";
import {
  AREA_TIE_ORDER,
  derivePriority,
  IMPACT_TIE_ORDER,
  MIN_GOOD_FIRST_ISSUE_PROBABILITY,
  MIN_SIGNAL_PROBABILITY,
  planLabels,
  TYPE_TIE_ORDER,
} from "./plan";
import type { PlanInput } from "./plan";
import { buildQuestions } from "./questions";
import { decide, SubqRequestFailed } from "./subq";
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

  it("applies a narrow top type and notes its runner-up", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.49,
          probabilities: { bug: 0.05, enhancement: 0.46, feature: 0.49 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type:feature");
    expect(plan.notes).toContain("type: feature (0.49; next enhancement 0.46)");
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

  it("keeps a workflow ready status on a low-confidence answer", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: ["status:ready"],
      workflowStatuses: ["status:ready"],
    });

    expect(plan.labels).toContain("type:bug");
    expect(plan.labels).not.toContain("status:needs-triage");
    expect(plan.removed).toEqual([]);
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

const CONFIDENCE_RANGE = [0, 0.1, 0.34, 0.59, 0.6, 1];

const answersAt = (confidence: number): Answers => ({
  ...confidentBug,
  area: { choice: "backend", confidence, type: "choice" },
  impact: { confidence, score: 3, type: "score" },
  type: { choice: "maintenance", confidence, type: "choice" },
});

describe("top label wins", () => {
  it("plans the top type, area and impact at any confidence", () => {
    for (const confidence of CONFIDENCE_RANGE) {
      const plan = planFor({ answers: answersAt(confidence) });

      expect(plan.labels).toContain("type:maintenance");
      expect(plan.labels).toContain("area:backend");
      expect(plan.labels).toContain("impact:critical");
      expect(plan.labels).toContain("priority:p0");
    }
  });

  it("raises no gap, status or comment for a low-confidence pick", () => {
    const plan = planFor({ answers: answersAt(0.1) });

    expect(plan.gaps.some((gap) => gap.text.startsWith("Pick the"))).toBe(
      false
    );

    expect(plan.status).toBe("status:ready");
    expect(renderGapComment("issue", plan.gaps)).toBeUndefined();
  });

  it("applies the top of a three-way spread", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.34,
          probabilities: { bug: 0.33, enhancement: 0.33, feature: 0.34 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type:feature");
  });
});

const impactAt = (score: number) =>
  planFor({
    answers: {
      ...confidentBug,
      impact: { confidence: 0.5, score, type: "score" },
      regression: { noul: 0.1, type: "noul" },
    },
  }).labels;

describe("tie order", () => {
  it("follows the option order of the type and area questions", () => {
    const issue = buildQuestions("issue", []);
    const pullRequest = buildQuestions("pull-request", []);

    expect(Object.keys(issue.type?.criteria ?? {})).toEqual([
      ...TYPE_TIE_ORDER,
    ]);

    expect(Object.keys(pullRequest.type?.criteria ?? {})).toEqual(
      TYPE_TIE_ORDER.filter((option) => option !== "question")
    );

    expect(Object.keys(issue.area?.criteria ?? {})).toEqual([
      ...AREA_TIE_ORDER,
    ]);

    expect(IMPACT_TIE_ORDER).toEqual([
      "impact:critical",
      "impact:high",
      "impact:medium",
      "impact:low",
    ]);
  });

  it("breaks an exact type tie by question order on every run", () => {
    const tied: Answers = {
      ...confidentBug,
      type: {
        choice: "feature",
        confidence: 0.4,
        probabilities: { bug: 0.4, enhancement: 0.2, feature: 0.4 },
        type: "choice",
      },
    };

    const runs = [1, 2, 3].map(() =>
      planFor({ answers: tied }).labels.filter((label) =>
        label.startsWith("type:")
      )
    );

    expect(runs).toEqual([["type:bug"], ["type:bug"], ["type:bug"]]);
  });

  it("breaks an exact area tie by question order", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        area: {
          choice: "infra",
          confidence: 0.45,
          probabilities: { "ci-cd": 0.1, docs: 0.45, infra: 0.45 },
          type: "choice",
        },
      },
    });

    expect(plan.labels).toContain("area:docs");
    expect(plan.labels).not.toContain("area:infra");
  });

  it("rounds an impact score exactly halfway up", () => {
    expect(impactAt(0.5)).toContain("impact:medium");
    expect(impactAt(1.5)).toContain("impact:high");
    expect(impactAt(1.5)).toContain("priority:p1");
    expect(impactAt(2.5)).toContain("impact:critical");
  });
});

describe("unusable answers", () => {
  it("falls back to the highest probability for an unknown choice", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        area: {
          choice: "mobile",
          confidence: 0.7,
          probabilities: { auth: 0.2, database: 0.5, mobile: 0.7 },
          type: "choice",
        },
      },
    });

    expect(plan.labels).toContain("area:database");
    expect(plan.notes).toContain("area: database (0.50; next auth 0.20)");
  });

  it("labels nothing and asks nothing for a missing type answer", () => {
    const { type: _type, ...withoutType } = confidentBug;
    const plan = planFor({ answers: withoutType, checklist: undefined });

    expect(plan.labels.some((label) => label.startsWith("type:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
    expect(plan.status).toBe("status:ready");
    expect(plan.notes).toContain("type: no answer");
  });

  it("notes no answer for a wrong answer type or an unknown choice", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        area: { choice: "mobile", confidence: 0.9, type: "choice" },
        impact: { noul: 0.9, type: "noul" },
      },
    });

    expect(plan.notes).toContain("area: no answer");
    expect(plan.notes).toContain("impact: no answer");
    expect(
      plan.labels.some(
        (label) => label.startsWith("area:") || label.startsWith("impact:")
      )
    ).toBe(false);

    expect(plan.gaps).toEqual([]);
  });

  it("notes the impact pick with its runner-up", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: {
          confidence: 0.4,
          probabilities: { "0": 0.1, "1": 0.45, "2": 0.45, "3": 0 },
          score: 1.5,
          type: "score",
        },
      },
    });

    expect(plan.notes).toContain(
      "impact: impact:high (score 1.50, 0.40; next impact:medium 0.45)"
    );
  });
});

describe("existing and refused labels", () => {
  it("never adds a pick over an existing group label and removes nothing", () => {
    const plan = planFor({
      answers: answersAt(0.2),
      existingLabels: ["type:bug", "area:frontend", "impact:low"],
    });

    expect(
      plan.labels.filter(
        (label) =>
          label.startsWith("type:") ||
          label.startsWith("area:") ||
          label.startsWith("impact:")
      )
    ).toEqual([]);

    expect(plan.removed).toEqual([]);
  });

  it("adds no other area once a maintainer removed the top one", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        area: {
          choice: "frontend",
          confidence: 0.5,
          probabilities: { backend: 0.4, frontend: 0.5 },
          type: "choice",
        },
      },
      refusedLabels: ["area:frontend"],
    });

    expect(plan.labels.some((label) => label.startsWith("area:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
    expect(plan.status).toBe("status:ready");
  });

  it("takes pull request areas from paths over the model's top area", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        area: { choice: "backend", confidence: 0.99, type: "choice" },
      },
      areasFromPaths: areasForPaths(["apps/web/src/app/router.tsx"]),
      checklist: undefined,
      kind: "pull-request",
    });

    expect(plan.labels).toContain("area:frontend");
    expect(plan.labels).not.toContain("area:backend");
  });

  it("raises the priority of a low-confidence impact for security", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: { confidence: 0.2, score: 0, type: "score" },
        regression: { noul: 0.1, type: "noul" },
        security: { noul: 0.9, type: "noul" },
      },
    });

    expect(plan.labels).toContain("impact:low");
    expect(plan.labels).toContain("priority:p0");
  });
});

const BAD_REQUEST = 400;

describe("decide", () => {
  afterEach(() => {
    mock.restore();
  });

  it("asks SubQ with the subq-snap-1.1 model", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        answers: { type: { choice: "bug", confidence: 1, type: "choice" } },
      })
    );

    const answers = await Effect.runPromise(decide("key", {}, {}));
    const requestBodies = fetchSpy.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );

    expect(answers.type?.type).toBe("choice");
    expect(requestBodies).toEqual([
      { model: "subq-snap-1.1", questions: {}, state: {} },
    ]);
  });

  it("fails with the request error when SubQ rejects the call", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad", { status: BAD_REQUEST })
    );

    const failure = await Effect.runPromise(
      decide("key", {}, {}).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(SubqRequestFailed);
    expect(failure.reason).toEqual({
      body: "bad",
      kind: "rejected",
      status: BAD_REQUEST,
    });
  });
});
