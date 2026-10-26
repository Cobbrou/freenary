import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Effect } from "effect";

import { renderGapComment } from "./comment";
import {
  derivePriority,
  IMPACT_TIE_ORDER,
  MIN_GOOD_FIRST_ISSUE_PROBABILITY,
  MIN_IMPACT_CONFIDENCE,
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
  blocked: { noul: 0.05, type: "noul" },
  check_environment: { noul: 0.9, type: "noul" },
  check_expected_actual: { noul: 0.9, type: "noul" },
  check_steps: { noul: 0.9, type: "noul" },
  impact: { confidence: 0.85, score: 1.8, type: "score" },
  regression: { noul: 0.1, type: "noul" },
  security: { noul: 0.2, type: "noul" },
  type: { choice: "bug", confidence: 0.95, type: "choice" },
};

const planFor = (overrides: Partial<PlanInput>) =>
  planLabels({
    answers: confidentBug,
    checklist: "bug",
    docsExpected: false,
    existingLabels: [],
    kind: "issue",
    refusedLabels: [],
    ruleGaps: [],
    workflowGoodFirstIssue: false,
    workflowPriorities: [],
    ...overrides,
  });

const startsWithAny = (label: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => label.startsWith(prefix));

describe("planLabels", () => {
  it("labels the type, impact and priority of a confident answer set", () => {
    expect(planFor({}).labels.toSorted()).toEqual(
      ["impact: high", "priority: high", "type: bug"].toSorted()
    );
  });

  it("never adds a status, area or signal label", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        regression: { noul: 0.95, type: "noul" },
        security: { noul: 0.95, type: "noul" },
      },
    });

    expect(
      plan.labels.some((label) =>
        startsWithAny(label, ["status:", "area:", "security", "regression"])
      )
    ).toBe(false);
  });

  it("applies a narrow top type and notes its runner-up", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.49,
          probabilities: { bug: 0.05, documentation: 0.46, feature: 0.49 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type: feature");
    expect(plan.notes).toContain(
      "type: feature (0.49; next documentation 0.46)"
    );
  });

  it("never overrides a group a maintainer already labelled", () => {
    const plan = planFor({
      existingLabels: ["type: feature", "impact: low", "priority: low"],
    });

    expect(plan.labels).toEqual([]);
    expect(plan.removed).toEqual([]);
  });

  it("flags a confident duplicate without a label", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: { choice: "item-14", confidence: 0.9, type: "choice" },
      },
    });

    expect(plan.duplicateOf).toBe(14);
    expect(plan.labels).not.toContain("duplicate");
    expect(plan.gaps).toContainEqual({
      owner: "maintainer",
      text: "Check whether this duplicates #14.",
    });
  });

  it("counts a group a maintainer labelled as settled", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      existingLabels: ["type: feature"],
    });

    expect(plan.status).toBe("ready");
  });
});

describe("buildQuestions", () => {
  it("stays within the sixteen questions a request allows", () => {
    const questions = buildQuestions("issue", [{ number: 3, title: "x" }]);

    expect(Object.keys(questions).length).toBeLessThanOrEqual(16);
  });

  it("asks pull requests about their description, not newcomers or impact", () => {
    const questions = buildQuestions("pull-request", []);

    expect(questions.good_first_issue).toBeUndefined();
    expect(questions.impact).toBeUndefined();
    expect(questions.area).toBeUndefined();
    expect(questions.pr_summary).toBeDefined();
    expect(questions.pr_docs).toBeDefined();
  });

  it("asks for three impact levels", () => {
    expect(buildQuestions("issue", []).impact?.criteria).toHaveLength(3);
  });
});

describe("taxonomy", () => {
  it("defines the twelve labels once", () => {
    const names = LABELS.map((label) => label.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names.toSorted()).toEqual(
      [
        "good first issue",
        "help wanted",
        "impact: high",
        "impact: low",
        "impact: medium",
        "priority: high",
        "priority: low",
        "priority: medium",
        "type: bug",
        "type: documentation",
        "type: feature",
        "type: maintenance",
      ].toSorted()
    );
  });
});

const goodFirstIssueLabelsAt = (noul: number) =>
  planFor({
    answers: {
      ...confidentBug,
      good_first_issue: { noul, type: "noul" },
    },
  }).labels;

describe("good first issue", () => {
  it("needs a stricter probability than the other signals", () => {
    expect(goodFirstIssueLabelsAt(MIN_SIGNAL_PROBABILITY)).not.toContain(
      "good first issue"
    );

    expect(
      goodFirstIssueLabelsAt(MIN_GOOD_FIRST_ISSUE_PROBABILITY - 0.01)
    ).not.toContain("good first issue");

    expect(goodFirstIssueLabelsAt(MIN_GOOD_FIRST_ISSUE_PROBABILITY)).toContain(
      "good first issue"
    );
  });
});

describe("derivePriority", () => {
  it("maps impact to priority", () => {
    expect(derivePriority("impact: high", [])).toBe("priority: high");
    expect(derivePriority("impact: medium", [])).toBe("priority: medium");
    expect(derivePriority("impact: low", [])).toBe("priority: low");
    expect(derivePriority(undefined, [])).toBeUndefined();
  });

  it("gives a security risk priority high, with or without an impact", () => {
    expect(derivePriority("impact: low", ["security"])).toBe("priority: high");
    expect(derivePriority(undefined, ["security"])).toBe("priority: high");
  });

  it("raises the priority of an impact by one level for a regression", () => {
    expect(derivePriority("impact: low", ["regression"])).toBe(
      "priority: medium"
    );

    expect(derivePriority("impact: medium", ["regression"])).toBe(
      "priority: high"
    );

    expect(derivePriority("impact: high", ["regression"])).toBe(
      "priority: high"
    );
  });

  it("gives a regression with no impact no priority", () => {
    expect(derivePriority(undefined, ["regression"])).toBeUndefined();
  });
});

const impactAt = (confidence: number, score = 2) =>
  planFor({
    answers: {
      ...confidentBug,
      impact: { confidence, score, type: "score" },
    },
  });

describe("impact and priority are never guessed", () => {
  it("applies neither below the confidence threshold", () => {
    const plan = impactAt(MIN_IMPACT_CONFIDENCE - 0.01);

    expect(
      plan.labels.some((label) =>
        startsWithAny(label, ["impact:", "priority:"])
      )
    ).toBe(false);

    expect(plan.notes.some((note) => note.startsWith("impact: none"))).toBe(
      true
    );
  });

  it("applies both at the threshold", () => {
    const plan = impactAt(MIN_IMPACT_CONFIDENCE);

    expect(plan.labels).toContain("impact: high");
    expect(plan.labels).toContain("priority: high");
  });

  it("applies neither without an impact answer", () => {
    const { impact: _impact, ...withoutImpact } = confidentBug;
    const plan = planFor({ answers: withoutImpact });

    expect(
      plan.labels.some((label) =>
        startsWithAny(label, ["impact:", "priority:"])
      )
    ).toBe(false);
  });

  it("applies neither to a pull request", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        pr_docs: { noul: 0.9, type: "noul" },
        pr_summary: { noul: 0.9, type: "noul" },
      },
      checklist: undefined,
      kind: "pull-request",
    });

    expect(
      plan.labels.some((label) =>
        startsWithAny(label, ["impact:", "priority:"])
      )
    ).toBe(false);
  });

  it("rounds a score exactly halfway up", () => {
    expect(impactAt(0.9, 0.5).labels).toContain("impact: medium");
    expect(impactAt(0.9, 0.5).labels).toContain("priority: medium");
    expect(impactAt(0.9, 1.5).labels).toContain("impact: high");
  });

  it("raises the priority of a confident security signal", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: { confidence: 0.9, score: 0, type: "score" },
        security: { noul: 0.9, type: "noul" },
      },
    });

    expect(plan.labels).toContain("impact: low");
    expect(plan.labels).toContain("priority: high");
  });

  it("ignores a security or regression signal below the threshold", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: { confidence: 0.9, score: 0, type: "score" },
        regression: { noul: MIN_SIGNAL_PROBABILITY - 0.01, type: "noul" },
        security: { noul: 0.5, type: "noul" },
      },
    });

    expect(plan.labels).toContain("priority: low");
  });
});

describe("planLabels priority", () => {
  it("derives priority from an impact label a maintainer set", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: { confidence: 0.3, score: 0, type: "score" },
      },
      existingLabels: ["impact: medium"],
    });

    expect(plan.labels).toContain("priority: medium");
  });

  it("keeps a priority a maintainer set", () => {
    const plan = planFor({ existingLabels: ["priority: low"] });

    expect(plan.labels.some((label) => label.startsWith("priority:"))).toBe(
      false
    );
  });
});

describe("workflow priority", () => {
  it("recomputes its own priority after a maintainer changes impact", () => {
    const plan = planFor({
      existingLabels: ["impact: low", "priority: high", "type: bug"],
      workflowPriorities: ["priority: high"],
    });

    expect(plan.labels).toContain("priority: low");
    expect(plan.removed).toContain("priority: high");
  });

  it("removes its own priority once a maintainer sets one", () => {
    const plan = planFor({
      existingLabels: ["priority: low", "priority: high"],
      workflowPriorities: ["priority: low"],
    });

    expect(plan.removed).toContain("priority: low");
    expect(plan.labels.some((label) => label.startsWith("priority:"))).toBe(
      false
    );
  });
});

describe("top label wins", () => {
  it("applies the top type at any confidence", () => {
    for (const confidence of [0, 0.1, 0.34, 0.59, 0.6, 1]) {
      const plan = planFor({
        answers: {
          ...confidentBug,
          type: { choice: "maintenance", confidence, type: "choice" },
        },
      });

      expect(plan.labels).toContain("type: maintenance");
    }
  });

  it("raises no gap for a low-confidence type", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.1, type: "choice" },
      },
    });

    expect(plan.gaps).toEqual([]);
    expect(plan.status).toBe("ready");
    expect(renderGapComment("issue", plan.gaps)).toBeUndefined();
  });

  it("applies the top of a three-way spread", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.34,
          probabilities: { bug: 0.33, documentation: 0.33, feature: 0.34 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type: feature");
  });
});

describe("tie order", () => {
  it("follows the option order of the type question", () => {
    const issue = buildQuestions("issue", []);
    const pullRequest = buildQuestions("pull-request", []);

    expect(Object.keys(issue.type?.criteria ?? {})).toEqual([
      ...TYPE_TIE_ORDER,
    ]);

    expect(Object.keys(pullRequest.type?.criteria ?? {})).toEqual([
      ...TYPE_TIE_ORDER,
    ]);

    expect(IMPACT_TIE_ORDER).toEqual([
      "impact: high",
      "impact: medium",
      "impact: low",
    ]);
  });

  it("breaks an exact type tie by question order on every run", () => {
    const tied: Answers = {
      ...confidentBug,
      type: {
        choice: "feature",
        confidence: 0.4,
        probabilities: { bug: 0.4, documentation: 0.2, feature: 0.4 },
        type: "choice",
      },
    };

    const runs = [1, 2, 3].map(() =>
      planFor({ answers: tied }).labels.filter((label) =>
        label.startsWith("type:")
      )
    );

    expect(runs).toEqual([["type: bug"], ["type: bug"], ["type: bug"]]);
  });
});

describe("unusable answers", () => {
  it("falls back to the highest probability for an unknown choice", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "question",
          confidence: 0.7,
          probabilities: {
            documentation: 0.2,
            feature: 0.5,
            question: 0.7,
          },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type: feature");
    expect(plan.notes).toContain(
      "type: feature (0.50; next documentation 0.20)"
    );
  });

  it("labels nothing and asks nothing for a missing type answer", () => {
    const { type: _type, ...withoutType } = confidentBug;
    const plan = planFor({ answers: withoutType, checklist: undefined });

    expect(plan.labels.some((label) => label.startsWith("type:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
    expect(plan.status).toBe("ready");
    expect(plan.notes).toContain("type: no answer");
  });

  it("notes no answer for a wrong answer type", () => {
    const plan = planFor({
      answers: { ...confidentBug, impact: { noul: 0.9, type: "noul" } },
    });

    expect(plan.notes).toContain("impact: no answer");
    expect(plan.labels.some((label) => label.startsWith("impact:"))).toBe(
      false
    );
  });
});

describe("existing and refused labels", () => {
  it("never adds a pick over an existing group label and removes nothing", () => {
    const plan = planFor({
      existingLabels: ["type: bug", "impact: low"],
    });

    expect(
      plan.labels.filter((label) => startsWithAny(label, ["type:", "impact:"]))
    ).toEqual([]);

    expect(plan.removed).toEqual([]);
  });

  it("adds nothing for a label a maintainer removed", () => {
    const plan = planFor({ refusedLabels: ["impact: high", "priority: high"] });

    expect(plan.labels).toEqual(["type: bug"]);
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
