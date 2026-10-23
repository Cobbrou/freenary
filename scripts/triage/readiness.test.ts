import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { COMMENT_MARKER, planCommentAction, renderGapComment } from "./comment";
import { planLabels, resolveTypeLabel } from "./plan";
import type { PlanInput } from "./plan";
import { buildQuestions } from "./questions";
import {
  checkGaps,
  checklistFor,
  checklistQuestions,
  decideReadiness,
  docsExpected,
  templateGaps,
} from "./readiness";
import type { Answers } from "./subq";

const TEMPLATE = readFileSync(".github/pull_request_template.md", "utf-8");

const settled: Answers = {
  area: { choice: "frontend", confidence: 0.9, type: "choice" },
  blocked: { noul: 0.05, type: "noul" },
  impact: { confidence: 0.8, score: 1, type: "score" },
  type: { choice: "feature", confidence: 0.9, type: "choice" },
};

const requestMet: Answers = {
  check_outcome: { noul: 0.9, type: "noul" },
  check_problem: { noul: 0.9, type: "noul" },
  check_scope: { noul: 0.9, type: "noul" },
};

const planFor = (overrides: Partial<PlanInput>) =>
  planLabels({
    answers: { ...settled, ...requestMet },
    areasFromPaths: [],
    checklist: "request",
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

describe("issue readiness", () => {
  it("marks an issue ready when every criterion is met", () => {
    const plan = planFor({});

    expect(plan.status).toBe("status:ready");
    expect(plan.gaps).toEqual([]);
  });

  it("asks the author for a missing criterion", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        check_problem: { noul: 0.2, type: "noul" },
      },
    });

    expect(plan.status).toBe("status:needs-info");
    expect(plan.gaps).toEqual([
      { owner: "author", text: "Explain the problem this would solve." },
    ]);
  });

  it("asks a maintainer for an open design choice", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        check_scope: { noul: 0.3, type: "noul" },
      },
    });

    expect(plan.status).toBe("status:needs-triage");
    expect(plan.gaps[0]?.owner).toBe("maintainer");
  });

  it("applies the top type of an unsure group and stays ready", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        type: {
          choice: "feature",
          confidence: 0.4,
          probabilities: { bug: 0.05, enhancement: 0.35, feature: 0.6 },
          type: "choice",
        },
      },
    });

    expect(plan.labels).toContain("type:feature");
    expect(plan.status).toBe("status:ready");
    expect(plan.gaps).toEqual([]);
  });

  it("applies the rounded impact level of an unsure score", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        impact: {
          confidence: 0.4,
          probabilities: { "0": 0.5, "1": 0.45, "2": 0.05, "3": 0 },
          score: 0.55,
          type: "score",
        },
      },
    });

    expect(plan.labels).toContain("impact:medium");
    expect(plan.labels).toContain("priority:p2");
    expect(plan.status).toBe("status:ready");
    expect(plan.gaps).toEqual([]);
  });

  it("leaves a question to a maintainer", () => {
    const plan = planFor({
      answers: {
        ...settled,
        type: { choice: "question", confidence: 0.9, type: "choice" },
      },
      checklist: undefined,
    });

    expect(plan.status).toBe("status:needs-triage");
    expect(plan.gaps).toContainEqual({
      owner: "maintainer",
      text: "Answer the question.",
    });
  });

  it("puts blocked before every gap", () => {
    const plan = planFor({
      answers: {
        ...settled,
        blocked: { noul: 0.9, type: "noul" },
        check_problem: { noul: 0.1, type: "noul" },
      },
    });

    expect(plan.status).toBe("status:blocked");
  });
});

describe("pull request readiness", () => {
  const prAnswers: Answers = {
    ...settled,
    pr_docs: { noul: 0.9, type: "noul" },
    pr_summary: { noul: 0.9, type: "noul" },
  };

  const pullRequestFor = (overrides: Partial<PlanInput>) =>
    planFor({
      answers: prAnswers,
      areasFromPaths: ["frontend"],
      checklist: undefined,
      kind: "pull-request",
      ...overrides,
    });

  it("is ready with a summary, notes and passing checks", () => {
    expect(pullRequestFor({}).status).toBe("status:ready");
  });

  it("asks for a summary", () => {
    const plan = pullRequestFor({
      answers: { ...prAnswers, pr_summary: { noul: 0.1, type: "noul" } },
    });

    expect(plan.status).toBe("status:needs-info");
  });

  it("asks about documentation only when behaviour changed without docs", () => {
    const noDocsNote: Answers = {
      ...prAnswers,
      pr_docs: { noul: 0.1, type: "noul" },
    };

    expect(pullRequestFor({ answers: noDocsNote }).status).toBe("status:ready");
    expect(
      pullRequestFor({ answers: noDocsNote, docsExpected: true }).status
    ).toBe("status:needs-info");
  });

  it("waits for checks without asking anyone", () => {
    const plan = pullRequestFor({
      ruleGaps: [{ owner: "waiting", text: "Wait for the `ci` check." }],
    });

    expect(plan.status).toBe("status:needs-triage");
    expect(renderGapComment("pull-request", plan.gaps)).toBeUndefined();
  });
});

describe("templateGaps", () => {
  it("accepts a filled template", () => {
    const body = TEMPLATE.replaceAll(
      /^(?:At most|What problem|What are|How have|One line).*$/gmu,
      "Written by the author."
    );

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });

  it("flags untouched and missing sections", () => {
    const body = TEMPLATE.replace(/# Notes[\s\S]*$/u, "");

    expect(templateGaps(TEMPLATE, body).map((gap) => gap.text)).toEqual([
      "Fill the Summary section.",
      "Fill the Motivation section.",
      "Fill the Drawbacks section.",
      "Fill the Prior art section.",
      "Fill the Notes section.",
    ]);
  });
});

describe("checkGaps", () => {
  it("waits for a running check and flags a failed one", () => {
    expect(
      checkGaps([
        { conclusion: null, id: 1, name: "ci", status: "in_progress" },
        { conclusion: "failure", id: 2, name: "compose", status: "completed" },
      ])
    ).toEqual([
      { owner: "waiting", text: "Wait for the `ci` check." },
      { owner: "author", text: "Fix the failing `compose` check." },
    ]);
  });

  it("passes when both checks succeed", () => {
    expect(
      checkGaps([
        { conclusion: "success", id: 1, name: "ci", status: "completed" },
        { conclusion: "success", id: 2, name: "compose", status: "completed" },
      ])
    ).toEqual([]);
  });
});

describe("docsExpected", () => {
  it("expects docs for behaviour code without a docs change", () => {
    expect(docsExpected(["apps/web/src/pages/budget/ui/page.tsx"])).toBe(true);
    expect(
      docsExpected([
        "apps/web/src/pages/budget/ui/page.tsx",
        "apps/fumadocs/content/docs/next/use/budget.mdx",
      ])
    ).toBe(false);

    expect(docsExpected(["scripts/triage/plan.ts"])).toBe(false);
  });
});

describe("checklists", () => {
  it("maps types to checklists", () => {
    expect(checklistFor("type:bug")).toBe("bug");
    expect(checklistFor("type:enhancement")).toBe("request");
    expect(checklistFor("type:question")).toBeUndefined();
  });

  it("keeps both rounds within sixteen questions", () => {
    const candidates = [{ number: 3, title: "x" }];

    expect(
      Object.keys(buildQuestions("issue", candidates)).length
    ).toBeLessThanOrEqual(16);

    expect(Object.keys(checklistQuestions("bug")).length).toBeLessThanOrEqual(
      16
    );
  });
});

describe("decideReadiness", () => {
  it("orders blocked, author, maintainer, ready", () => {
    expect(decideReadiness(true, [])).toBe("blocked");
    expect(
      decideReadiness(false, [
        { owner: "maintainer", text: "m" },
        { owner: "author", text: "a" },
      ])
    ).toBe("needs-info");

    expect(decideReadiness(false, [{ owner: "maintainer", text: "m" }])).toBe(
      "needs-triage"
    );

    expect(decideReadiness(false, [])).toBe("ready");
  });
});

describe("renderGapComment", () => {
  it("groups gaps by owner under the marker", () => {
    const comment = renderGapComment("issue", [
      { owner: "maintainer", text: "Answer the question." },
      { owner: "author", text: "Add the steps that reproduce the bug." },
    ]);

    expect(comment?.startsWith(COMMENT_MARKER)).toBe(true);
    expect(comment).toContain(
      "For the author:\n- Add the steps that reproduce the bug."
    );

    expect(comment).toContain("For a maintainer:\n- Answer the question.");
  });
});

describe("checkGaps with reruns", () => {
  it("reads the newest run of a check", () => {
    expect(
      checkGaps([
        { conclusion: "success", id: 9, name: "ci", status: "completed" },
        { conclusion: "failure", id: 3, name: "ci", status: "completed" },
        { conclusion: "success", id: 4, name: "compose", status: "completed" },
      ])
    ).toEqual([]);
  });
});

describe("needs-reproduction", () => {
  const bugAnswers: Answers = {
    ...settled,
    check_environment: { noul: 0.9, type: "noul" },
    check_expected_actual: { noul: 0.9, type: "noul" },
    check_steps: { noul: 0.9, type: "noul" },
    type: { choice: "bug", confidence: 0.9, type: "choice" },
  };

  it("removes the label it added once the steps are written", () => {
    const plan = planFor({
      answers: bugAnswers,
      checklist: "bug",
      existingLabels: ["needs-reproduction"],
      workflowReproduction: true,
    });

    expect(plan.removed).toContain("needs-reproduction");
  });

  it("removes the label it added once the type is no longer bug", () => {
    const plan = planFor({
      answers: { ...settled, ...requestMet },
      checklist: "request",
      existingLabels: ["needs-reproduction"],
      workflowReproduction: true,
    });

    expect(plan.removed).toContain("needs-reproduction");
  });

  it("keeps a label a maintainer added", () => {
    const plan = planFor({
      answers: bugAnswers,
      checklist: "bug",
      existingLabels: ["needs-reproduction"],
      workflowReproduction: false,
    });

    expect(plan.removed).not.toContain("needs-reproduction");
  });
});

describe("pull request summary", () => {
  it("lists an empty Summary once", () => {
    const plan = planFor({
      answers: { ...settled, pr_summary: { noul: 0.1, type: "noul" } },
      checklist: undefined,
      kind: "pull-request",
      ruleGaps: [{ owner: "author", text: "Fill the Summary section." }],
    });

    expect(
      plan.gaps.filter((gap) => gap.text.includes("Summary"))
    ).toHaveLength(1);
  });
});

describe("planCommentAction", () => {
  const ours = {
    body: `${COMMENT_MARKER}\nold`,
    id: 7,
    user: { login: "github-actions[bot]" },
  };

  const someoneElse = {
    body: `${COMMENT_MARKER}\nquoted`,
    id: 8,
    user: { login: "octocat" },
  };

  const actionFor = (
    comments: readonly (typeof ours)[],
    reply: { readonly body: string | undefined }
  ) =>
    planCommentAction({
      author: "github-actions[bot]",
      body: reply.body,
      comments,
    });

  it("creates, updates, deletes or leaves the comment", () => {
    expect(actionFor([someoneElse], { body: "new" })).toEqual({
      body: "new",
      kind: "create",
    });

    expect(actionFor([ours], { body: "new" })).toEqual({
      body: "new",
      id: 7,
      kind: "update",
    });

    expect(actionFor([ours], { body: undefined })).toEqual({
      id: 7,
      kind: "delete",
    });

    expect(actionFor([], { body: undefined })).toEqual({ kind: "none" });
    expect(actionFor([ours], { body: ours.body })).toEqual({ kind: "none" });
  });
});

describe("refused labels", () => {
  it("never adds back a label a maintainer removed", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        security: { noul: 0.95, type: "noul" },
      },
      refusedLabels: ["security", "type:feature"],
    });

    expect(plan.labels).not.toContain("security");
    expect(plan.labels).not.toContain("type:feature");
  });
});

describe("refused labels and readiness", () => {
  it("derives no priority from a refused security label", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        impact: { confidence: 0.9, score: 0, type: "score" },
        security: { noul: 0.95, type: "noul" },
      },
      refusedLabels: ["security"],
    });

    expect(plan.labels).toContain("priority:p3");
    expect(plan.labels).not.toContain("priority:p0");
  });

  it("adds no type and asks nothing when the model's type was refused", () => {
    const plan = planFor({
      answers: {
        ...requestMet,
        ...settled,
        type: {
          choice: "feature",
          confidence: 0.9,
          probabilities: { enhancement: 0.08, feature: 0.9 },
          type: "choice",
        },
      },
      refusedLabels: ["type:feature"],
    });

    expect(plan.labels.some((label) => label.startsWith("type:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
  });

  it("drops the duplicate check once duplicate was refused", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        duplicate: { choice: "item-3", confidence: 0.95, type: "choice" },
      },
      refusedLabels: ["duplicate"],
    });

    expect(plan.status).toBe("status:ready");
  });

  it("still sets a status a maintainer once removed", () => {
    const plan = planFor({
      existingLabels: ["status:needs-triage"],
      refusedLabels: ["status:ready"],
      workflowStatuses: ["status:needs-triage"],
    });

    expect(plan.labels).toContain("status:ready");
    expect(plan.removed).toEqual(["status:needs-triage"]);
  });
});

describe("resolveTypeLabel", () => {
  it("ignores a model type a maintainer removed", () => {
    const answers: Answers = {
      type: { choice: "bug", confidence: 0.9, type: "choice" },
    };

    expect(checklistFor(resolveTypeLabel(answers, [], []))).toBe("bug");
    expect(
      checklistFor(resolveTypeLabel(answers, [], ["type:bug"]))
    ).toBeUndefined();

    expect(resolveTypeLabel(answers, ["type:feature"], ["type:bug"])).toBe(
      "type:feature"
    );
  });

  it("asks no question answer for a refused question type", () => {
    const plan = planFor({
      answers: {
        ...settled,
        type: { choice: "question", confidence: 0.9, type: "choice" },
      },
      checklist: undefined,
      refusedLabels: ["type:question"],
    });

    expect(plan.gaps.map((gap) => gap.text)).not.toContain(
      "Answer the question."
    );
  });
});

describe("refused picks and comment wording", () => {
  it("substitutes no other area for a refused top area", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        area: {
          choice: "frontend",
          confidence: 0.9,
          probabilities: { backend: 0.08, frontend: 0.9 },
          type: "choice",
        },
      },
      refusedLabels: ["area:frontend"],
    });

    expect(plan.labels.some((label) => label.startsWith("area:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
    expect(plan.status).toBe("status:ready");
  });

  it("tells a maintainer-only comment that a label reruns triage", () => {
    const comment = renderGapComment("issue", [
      { owner: "maintainer", text: "Answer the question." },
    ]);

    expect(comment).toContain(
      "a `status:` label set by a maintainer closes this list"
    );

    expect(comment).not.toContain("reply here");
  });
});

describe("missing answers", () => {
  it("keeps needs-reproduction while the type has no answer", () => {
    const { type: _type, ...withoutType } = settled;
    const plan = planFor({
      answers: withoutType,
      checklist: undefined,
      existingLabels: ["needs-reproduction"],
      workflowReproduction: true,
    });

    expect(plan.removed).not.toContain("needs-reproduction");
  });

  it("counts a missing checklist answer as unmet", () => {
    const plan = planFor({ answers: { ...settled } });

    expect(plan.status).toBe("status:needs-info");
  });
});

describe("documented paths and heading levels", () => {
  it("expects docs for server routes and instance configuration", () => {
    expect(docsExpected(["apps/server/src/index.ts"])).toBe(true);
    expect(docsExpected(["packages/instance-config/src/claim.ts"])).toBe(true);
  });

  it("accepts a template filled under level-two headings", () => {
    const body = TEMPLATE.replaceAll(/^# /gmu, "## ").replaceAll(
      /^(?:At most|What problem|What are|How have|One line).*$/gmu,
      "Written by the author."
    );

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });
});

describe("template sections with nested content", () => {
  const filled = TEMPLATE.replaceAll(
    /^(?:At most|What problem|What are|How have|One line).*$/gmu,
    "Written by the author."
  );

  it("keeps a sub-heading inside a filled section", () => {
    const body = filled.replace("# Summary\n", "# Summary\n\n## Context\n");

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });

  it("ignores a template heading inside a code fence", () => {
    const body = filled.replace(
      /# Motivation/u,
      "```md\n# Summary\n```\n\n# Motivation"
    );

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });
});

describe("fenced blocks with wide characters", () => {
  const ASTRAL_CODE_POINT = 0x1_f6_00;
  const ASTRAL_RUN_LENGTH = 10;

  it("keeps section bounds after a fence of astral characters", () => {
    const astralRun =
      String.fromCodePoint(ASTRAL_CODE_POINT).repeat(ASTRAL_RUN_LENGTH);

    const body = TEMPLATE.replace(
      /^At most.*$/mu,
      `Adds X.\n\n\`\`\`txt\n${astralRun}\n\`\`\``
    ).replace(/^One line.*$/mu, "Closes #1");

    expect(templateGaps(TEMPLATE, body).map((gap) => gap.text)).toEqual([
      "Fill the Motivation section.",
      "Fill the Drawbacks section.",
      "Fill the Prior art section.",
    ]);
  });
});

describe("headings with closing hashes", () => {
  it("reads a closed ATX heading as its title", () => {
    const body = TEMPLATE.replaceAll(
      /^# (?<title>.+)$/gmu,
      "## $<title> ##"
    ).replaceAll(
      /^(?:At most|What problem|What are|How have|One line).*$/gmu,
      "Written by the author."
    );

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });
});

describe("superseded checks", () => {
  it("waits on a cancelled or stale check instead of blaming the author", () => {
    expect(
      checkGaps([
        { conclusion: "cancelled", id: 1, name: "ci", status: "completed" },
        { conclusion: "stale", id: 2, name: "compose", status: "completed" },
      ])
    ).toEqual([
      { owner: "waiting", text: "Wait for the `ci` check." },
      { owner: "waiting", text: "Wait for the `compose` check." },
    ]);
  });
});
