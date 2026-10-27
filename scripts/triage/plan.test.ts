import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Effect } from "effect";

import { renderGapComment } from "./comment";
import {
  derivePriority,
  GOOD_FIRST_ISSUE_TIE_ORDER,
  IMPACT_TIE_ORDER,
  MIN_DUPLICATE_CONFIDENCE,
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
    duplicateCandidates: [9, 14],
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

const duplicateAt = (probabilities: Record<string, number>) =>
  planFor({
    answers: {
      ...confidentBug,
      duplicate: {
        choice: "item-14",
        confidence: 0.4,
        probabilities,
        type: "choice",
      },
    },
  }).duplicateOf;

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

  it("flags a duplicate without a label", () => {
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

  it("flags the most probable duplicate over the stated choice", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: {
          choice: "none",
          confidence: 0.05,
          probabilities: { "item-14": 0.9, "item-9": 0.05, none: 0.05 },
          type: "choice",
        },
      },
    });

    expect(plan.duplicateOf).toBe(14);
  });

  it("flags a duplicate only from its threshold", () => {
    expect(MIN_DUPLICATE_CONFIDENCE).toBe(0.85);

    expect(
      duplicateAt({ "item-14": MIN_DUPLICATE_CONFIDENCE, none: 0.15 })
    ).toBe(14);

    const below = planFor({
      answers: {
        ...confidentBug,
        duplicate: {
          choice: "item-14",
          confidence: 0.6,
          probabilities: { "item-14": 0.6, none: 0.4 },
          type: "choice",
        },
      },
    });

    expect(below.duplicateOf).toBeUndefined();
    expect(below.gaps).toEqual([]);
    expect(below.notes).toContain("duplicate: item-14 (0.60)");
  });

  it("flags nothing when none is the top duplicate answer", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: { choice: "none", confidence: 0.2, type: "choice" },
      },
    });

    expect(plan.duplicateOf).toBeUndefined();
    expect(plan.gaps).toEqual([]);
  });

  it("flags nothing without a usable duplicate answer", () => {
    for (const duplicate of [
      undefined,
      { noul: 0.99, type: "noul" as const },
      { choice: "item-x", confidence: 0.99, type: "choice" as const },
    ]) {
      const plan = planFor({
        answers: duplicate ? { ...confidentBug, duplicate } : confidentBug,
      });

      expect(plan.duplicateOf).toBeUndefined();
      expect(plan.gaps).toEqual([]);
    }
  });

  it("keeps a stated duplicate that probabilities leave out", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: {
          choice: "item-14",
          confidence: 0.9,
          probabilities: {},
          type: "choice",
        },
      },
    });

    expect(plan.duplicateOf).toBe(14);
  });

  it("flags only an item it offered as a candidate", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        duplicate: {
          choice: "item-77",
          confidence: 0.95,
          probabilities: { "item-14": 0.03, "item-77": 0.95, none: 0.02 },
          type: "choice",
        },
      },
    });

    expect(plan.duplicateOf).toBeUndefined();
    expect(plan.notes).toContain("duplicate: item-14 (0.03)");
  });

  it("breaks an exact duplicate tie toward none, then the lowest number", () => {
    expect(duplicateAt({ "item-14": 0.5, none: 0.5 })).toBeUndefined();

    const tied = planFor({
      answers: {
        ...confidentBug,
        duplicate: {
          choice: "item-14",
          confidence: 0.45,
          probabilities: { "item-14": 0.45, "item-9": 0.45, none: 0.1 },
          type: "choice",
        },
      },
    });

    expect(tied.notes).toContain("duplicate: item-9 (0.45)");
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

  it("asks for three impact levels as a score", () => {
    const { impact } = buildQuestions("issue", []);

    expect(impact?.type).toBe("score");
    expect(impact?.criteria).toHaveLength(3);
  });

  it("asks a choice for type, good first issue and duplicate", () => {
    const questions = buildQuestions("issue", [{ number: 3, title: "x" }]);

    expect(questions.type?.type).toBe("choice");
    expect(questions.good_first_issue?.type).toBe("choice");
    expect(questions.duplicate?.type).toBe("choice");
    expect(
      Object.keys(questions.good_first_issue?.criteria ?? {}).toSorted()
    ).toEqual(["good_first_issue", "none"]);
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

const goodFirstIssue = (
  choice: string,
  probabilities: Record<string, number> | undefined = undefined
): Answers => ({
  ...confidentBug,
  good_first_issue: { choice, confidence: 0.1, probabilities, type: "choice" },
});

describe("good first issue", () => {
  it("applies the label only for a top good_first_issue, at any confidence", () => {
    expect(
      planFor({ answers: goodFirstIssue("good_first_issue") }).labels
    ).toContain("good first issue");

    expect(planFor({ answers: goodFirstIssue("none") }).labels).not.toContain(
      "good first issue"
    );
  });

  it("follows the probabilities over the stated choice", () => {
    const winsByProbability = planFor({
      answers: goodFirstIssue("none", { good_first_issue: 0.6, none: 0.4 }),
    });

    const losesByProbability = planFor({
      answers: goodFirstIssue("good_first_issue", {
        good_first_issue: 0.4,
        none: 0.6,
      }),
    });

    expect(winsByProbability.labels).toContain("good first issue");
    expect(losesByProbability.labels).not.toContain("good first issue");
  });

  it("breaks an exact tie toward none", () => {
    expect(GOOD_FIRST_ISSUE_TIE_ORDER).toEqual(["none", "good_first_issue"]);

    const plan = planFor({
      answers: goodFirstIssue("good_first_issue", {
        good_first_issue: 0.5,
        none: 0.5,
      }),
    });

    expect(plan.labels).not.toContain("good first issue");
  });

  it("is withheld until the spec is complete", () => {
    const plan = planFor({
      answers: goodFirstIssue("good_first_issue"),
      ruleGaps: [{ owner: "author", text: "Add steps." }],
    });

    expect(plan.labels).not.toContain("good first issue");
    expect(plan.notes).toContain(
      "good first issue: withheld until the spec is complete"
    );
  });

  it("applies a narrow yes on a ready issue", () => {
    const plan = planFor({
      answers: goodFirstIssue("good_first_issue", {
        good_first_issue: 0.51,
        none: 0.49,
      }),
    });

    expect(plan.status).toBe("ready");
    expect(plan.labels).toContain("good first issue");
  });

  it("keeps its own label when a later run answers none", () => {
    const plan = planFor({
      answers: goodFirstIssue("none"),
      existingLabels: ["good first issue"],
      workflowGoodFirstIssue: true,
    });

    expect(plan.removed).not.toContain("good first issue");
  });

  it("notes no answer when the question went unanswered", () => {
    const plan = planFor({ answers: confidentBug });

    expect(plan.labels).not.toContain("good first issue");
    expect(plan.notes).toContain("good_first_issue: no answer");
  });

  it("is not applied without a usable answer", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        good_first_issue: { noul: 0.99, type: "noul" },
      },
    });

    expect(plan.labels).not.toContain("good first issue");
  });
});

describe("derivePriority", () => {
  it("maps impact to priority", () => {
    expect(derivePriority("impact: high", [])).toBe("priority: high");
    expect(derivePriority("impact: medium", [])).toBe("priority: medium");
    expect(derivePriority("impact: low", [])).toBe("priority: low");
    expect(derivePriority(undefined, [])).toBeUndefined();
  });

  it("gives a security risk priority high only with an impact", () => {
    expect(derivePriority("impact: low", ["security"])).toBe("priority: high");
    expect(derivePriority(undefined, ["security"])).toBeUndefined();
    expect(
      derivePriority(undefined, ["security", "regression"])
    ).toBeUndefined();
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

const impactAnswer = (
  score: number,
  probabilities: Record<string, number> | undefined = undefined
): Answers => ({
  ...confidentBug,
  impact: { confidence: 0.1, probabilities, score, type: "score" },
});

const labelsFor = (answers: Answers) => planFor({ answers }).labels;

const priorityLabelsAt = (key: "regression" | "security", noul: number) =>
  planFor({
    answers: {
      ...confidentBug,
      impact: { confidence: 0.9, score: 0, type: "score" },
      [key]: { noul, type: "noul" },
    },
  }).labels;

describe("impact and priority", () => {
  it("applies the most probable level and its priority at any confidence", () => {
    const plan = planFor({
      answers: impactAnswer(2, { "0": 0.9, "1": 0.05, "2": 0.05 }),
    });

    expect(plan.labels).toContain("impact: low");
    expect(plan.labels).toContain("priority: low");
    expect(plan.notes).toContain(
      "impact: impact: low (score 2.00, 0.90; next impact: high 0.05)"
    );
  });

  it("breaks an exact level tie toward the higher level", () => {
    const plan = planFor({ answers: impactAnswer(0, { "0": 0.5, "2": 0.5 }) });

    expect(plan.labels).toContain("impact: high");
    expect(plan.labels).toContain("priority: high");
  });

  it("falls back to the score, rounded halfway up, without a level probability", () => {
    expect(labelsFor(impactAnswer(0.5))).toContain("impact: medium");
    expect(labelsFor(impactAnswer(0.5))).toContain("priority: medium");
    expect(labelsFor(impactAnswer(1.5))).toContain("impact: high");
    expect(labelsFor(impactAnswer(0.4, { "7": 0.9 }))).toContain("impact: low");
    expect(labelsFor(impactAnswer(1, { "0": Number.NaN }))).toContain(
      "impact: medium"
    );
  });

  it("applies neither without a usable impact answer", () => {
    const { impact: _impact, ...withoutImpact } = confidentBug;

    for (const answers of [
      withoutImpact,
      impactAnswer(Number.NaN),
      impactAnswer(Number.NaN, { "0": Number.NaN }),
      {
        ...confidentBug,
        impact: { choice: "high", confidence: 0.9, type: "choice" as const },
      },
    ]) {
      const plan = planFor({
        answers: { ...answers, security: { noul: 0.99, type: "noul" } },
      });

      expect(
        plan.labels.some((label) =>
          startsWithAny(label, ["impact:", "priority:"])
        )
      ).toBe(false);

      expect(plan.notes).toContain("impact: no answer");
    }
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

  it("raises priority for a confident security signal", () => {
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

  it("applies a security or regression signal from exactly the threshold", () => {
    expect(MIN_SIGNAL_PROBABILITY).toBe(0.8);
    expect(priorityLabelsAt("security", MIN_SIGNAL_PROBABILITY)).toContain(
      "priority: high"
    );

    expect(
      priorityLabelsAt("security", MIN_SIGNAL_PROBABILITY - 0.01)
    ).toContain("priority: low");

    expect(priorityLabelsAt("regression", MIN_SIGNAL_PROBABILITY)).toContain(
      "priority: medium"
    );

    expect(
      priorityLabelsAt("regression", MIN_SIGNAL_PROBABILITY - 0.01)
    ).toContain("priority: low");
  });

  it("raises regression priority by one level", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        impact: { confidence: 0.9, score: 0, type: "score" },
        regression: { noul: 0.99, type: "noul" },
      },
    });

    expect(plan.labels).toContain("priority: medium");
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
  });

  it("gives an impact tie to the higher level", () => {
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

  it("takes the most probable type over the stated choice", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.4,
          probabilities: { bug: 0.6, feature: 0.4 },
          type: "choice",
        },
      },
    });

    expect(plan.labels).toContain("type: bug");
    expect(plan.labels).not.toContain("type: feature");
  });

  it("keeps the stated choice when every probability is unknown or not a number", () => {
    for (const probabilities of [
      { question: 0.9 },
      { bug: Number.NaN, feature: Number.NaN },
      {},
    ] as Record<string, number>[]) {
      const plan = planFor({
        answers: {
          ...confidentBug,
          type: {
            choice: "feature",
            confidence: 0.3,
            probabilities,
            type: "choice",
          },
        },
        checklist: undefined,
      });

      expect(plan.labels).toContain("type: feature");
    }
  });

  it("keeps a stated option that probabilities leave out", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "feature",
          confidence: 0.7,
          probabilities: { bug: 0.2 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels).toContain("type: feature");
    expect(plan.notes).toContain("type: feature (0.70; next bug 0.20)");
  });

  it("labels nothing for an unknown choice with no usable probability", () => {
    const plan = planFor({
      answers: {
        ...confidentBug,
        type: {
          choice: "question",
          confidence: 0.9,
          probabilities: { bug: Number.NaN, question: 0.9 },
          type: "choice",
        },
      },
      checklist: undefined,
    });

    expect(plan.labels.some((label) => label.startsWith("type:"))).toBe(false);
    expect(plan.notes).toContain("type: no answer");
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
