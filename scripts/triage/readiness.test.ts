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
  openItemsToDefine,
  stillToDefineGaps,
  templateGaps,
} from "./readiness";
import type { Answers } from "./subq";

const TEMPLATE = readFileSync(".github/pull_request_template.md", "utf-8");

const settled: Answers = {
  blocked: { noul: 0.05, type: "noul" },
  impact: { confidence: 0.85, score: 1, type: "score" },
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
    checklist: "request",
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

describe("issue readiness", () => {
  it("marks an issue ready when every criterion is met", () => {
    const plan = planFor({});

    expect(plan.status).toBe("ready");
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

    expect(plan.status).toBe("needs-info");
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

    expect(plan.status).toBe("needs-triage");
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
          probabilities: { bug: 0.05, documentation: 0.35, feature: 0.6 },
          type: "choice",
        },
      },
    });

    expect(plan.labels).toContain("type: feature");
    expect(plan.status).toBe("ready");
    expect(plan.gaps).toEqual([]);
  });

  it("applies the top impact and its priority for a low-confidence answer", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        impact: {
          confidence: 0.4,
          probabilities: { "0": 0.5, "1": 0.45, "2": 0.05 },
          score: 0.55,
          type: "score",
        },
      },
    });

    expect(plan.labels).toContain("impact: low");

    expect(plan.labels).toContain("priority: low");

    expect(plan.notes).toContain(
      "impact: impact: low (score 0.55, 0.50; next impact: medium 0.45)"
    );

    expect(plan.status).toBe("ready");
    expect(plan.gaps).toEqual([]);
  });

  it("puts blocked before every gap", () => {
    const plan = planFor({
      answers: {
        ...settled,
        blocked: { noul: 0.9, type: "noul" },
        check_problem: { noul: 0.1, type: "noul" },
      },
    });

    expect(plan.status).toBe("blocked");
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
      checklist: undefined,
      kind: "pull-request",
      ...overrides,
    });

  it("is ready with a summary, notes and passing checks", () => {
    expect(pullRequestFor({}).status).toBe("ready");
  });

  it("asks for a summary", () => {
    const plan = pullRequestFor({
      answers: { ...prAnswers, pr_summary: { noul: 0.1, type: "noul" } },
    });

    expect(plan.status).toBe("needs-info");
  });

  it("asks about documentation only when behaviour changed without docs", () => {
    const noDocsNote: Answers = {
      ...prAnswers,
      pr_docs: { noul: 0.1, type: "noul" },
    };

    expect(pullRequestFor({ answers: noDocsNote }).status).toBe("ready");
    expect(
      pullRequestFor({ answers: noDocsNote, docsExpected: true }).status
    ).toBe("needs-info");
  });

  it("waits for checks without asking anyone", () => {
    const plan = pullRequestFor({
      ruleGaps: [{ owner: "waiting", text: "Wait for the `ci` check." }],
    });

    expect(plan.status).toBe("needs-triage");
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

const withEvidence = (body: string): string =>
  body.replace(/^Optional, .*$/mu, "![Bank step](https://example.com/a.png)");

describe("the optional Evidence section", () => {
  const filled = TEMPLATE.replaceAll(
    /^(?:At most|What problem|What are|How have|One line).*$/gmu,
    "Written by the author."
  );

  it("is listed in the template as optional", () => {
    expect(TEMPLATE).toContain("# Evidence");
    expect(TEMPLATE).toMatch(/^Optional, /mu);
  });

  it("asks for nothing when the section is deleted", () => {
    const body = filled.replace(/# Evidence[\s\S]*?(?=# Notes)/u, "");

    expect(body).not.toContain("# Evidence");
    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });

  it("asks for nothing when the section is empty", () => {
    const body = filled.replace(/^Optional, .*$/mu, "");

    expect(templateGaps(TEMPLATE, body)).toEqual([]);
  });

  it("keeps the sections around a filled one apart", () => {
    const priorArtUntouched = TEMPLATE.replaceAll(
      /^(?:At most|What problem|What are|One line).*$/gmu,
      "Written by the author."
    );

    const notesUntouched = TEMPLATE.replaceAll(
      /^(?:At most|What problem|What are|How have).*$/gmu,
      "Written by the author."
    );

    const gapsOf = (body: string): string[] =>
      templateGaps(TEMPLATE, withEvidence(body)).map((gap) => gap.text);

    expect(gapsOf(filled)).toEqual([]);
    expect(gapsOf(priorArtUntouched)).toEqual(["Fill the Prior art section."]);
    expect(gapsOf(notesUntouched)).toEqual(["Fill the Notes section."]);
  });

  it("still flags another missing section", () => {
    const body = filled.replace(/# Drawbacks[\s\S]*?(?=# Prior art)/u, "");

    expect(templateGaps(TEMPLATE, body).map((gap) => gap.text)).toEqual([
      "Fill the Drawbacks section.",
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
    expect(checklistFor("type: bug")).toBe("bug");
    expect(checklistFor("type: feature")).toBe("request");
    expect(checklistFor("type: documentation")).toBe("documentation");
    expect(checklistFor("type: maintenance")).toBe("maintenance");
    expect(checklistFor("type: question")).toBeUndefined();
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
      {
        owner: "maintainer",
        text: "Decide the open design question or the scope.",
      },
      { owner: "author", text: "Add the steps that reproduce the bug." },
    ]);

    expect(comment?.startsWith(COMMENT_MARKER)).toBe(true);
    expect(comment).toContain(
      "For the author:\n- Add the steps that reproduce the bug."
    );

    expect(comment).toContain(
      "For a maintainer:\n- Decide the open design question or the scope."
    );
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
      refusedLabels: ["priority: high", "type: feature"],
    });

    expect(plan.labels).not.toContain("priority: high");
    expect(plan.labels).not.toContain("type: feature");
  });
});

describe("refused labels and readiness", () => {
  it("adds no type and asks nothing when the model's type was refused", () => {
    const plan = planFor({
      answers: {
        ...requestMet,
        ...settled,
        type: {
          choice: "feature",
          confidence: 0.9,
          probabilities: { documentation: 0.08, feature: 0.9 },
          type: "choice",
        },
      },
      refusedLabels: ["type: feature"],
    });

    expect(plan.labels.some((label) => label.startsWith("type:"))).toBe(false);
    expect(plan.gaps).toEqual([]);
  });
});

describe("resolveTypeLabel", () => {
  it("ignores a model type a maintainer removed", () => {
    const answers: Answers = {
      type: { choice: "bug", confidence: 0.9, type: "choice" },
    };

    expect(checklistFor(resolveTypeLabel(answers, [], []))).toBe("bug");
    expect(
      checklistFor(resolveTypeLabel(answers, [], ["type: bug"]))
    ).toBeUndefined();

    expect(resolveTypeLabel(answers, ["type: feature"], ["type: bug"])).toBe(
      "type: feature"
    );
  });
});

describe("refused picks and comment wording", () => {
  it("tells a maintainer-only comment that a label reruns triage", () => {
    const comment = renderGapComment("issue", [
      {
        owner: "maintainer",
        text: "Decide the open design question or the scope.",
      },
    ]);

    expect(comment).toContain(
      "a maintainer setting a `priority:` label closes this list"
    );

    expect(comment).not.toContain("reply here");
  });
});

describe("missing answers", () => {
  it("counts a missing checklist answer as unmet", () => {
    const plan = planFor({ answers: { ...settled } });

    expect(plan.status).toBe("needs-info");
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

const issue = (section: string): string =>
  `### Context\n\nWhy.\n\n### Still to define\n\n${section}\n\n### Acceptance criteria\n\n- [ ] It works\n`;

describe("Still to define", () => {
  it("lists the unchecked items of the checklist", () => {
    expect(
      openItemsToDefine(issue("- [ ] Pick the export format\n- [x] Name"))
    ).toEqual(["Pick the export format"]);
  });

  it("is empty once every item is ticked", () => {
    expect(openItemsToDefine(issue("- [x] Pick the format"))).toEqual([]);
    expect(stillToDefineGaps(issue("- [x] Pick the format"))).toEqual([]);
  });

  it("is empty for a missing, blank or placeholder section", () => {
    expect(openItemsToDefine("### Context\n\nWhy.\n")).toEqual([]);
    expect(openItemsToDefine(issue(""))).toEqual([]);
    expect(openItemsToDefine(issue("_No response_"))).toEqual([]);
    expect(openItemsToDefine(issue("None"))).toEqual([]);
    expect(openItemsToDefine(issue("<!-- list what is open -->"))).toEqual([]);
  });

  it("treats free text as one open item", () => {
    expect(openItemsToDefine(issue("The export format."))).toEqual([
      "The export format.",
    ]);
  });

  it("stops at the next heading and ignores checklists elsewhere", () => {
    expect(openItemsToDefine(issue("- [x] done"))).toEqual([]);
  });

  it("is not cut short by a heading inside a code fence", () => {
    const body =
      "### Still to define\n\n```md\n# not a heading\n```\n\n- [ ] Pick the format\n";

    expect(openItemsToDefine(body)).toEqual(["Pick the format"]);
  });

  it("ignores a checkbox inside a code fence", () => {
    const body = "### Still to define\n\n```md\n- [ ] an example\n```\n";

    expect(openItemsToDefine(body)).toEqual([]);
  });

  it("asks a maintainer to settle the open items", () => {
    expect(stillToDefineGaps(issue("- [ ] Pick the format"))).toEqual([
      {
        owner: "maintainer",
        text: "Settle the open items under Still to define, and tick or remove each one.",
      },
    ]);
  });
});

describe("good first issue", () => {
  const wantsIt: Answers = {
    ...settled,
    ...requestMet,
    good_first_issue: {
      choice: "good_first_issue",
      confidence: 0.99,
      type: "choice",
    },
  };

  it("is applied to a ready issue", () => {
    expect(planFor({ answers: wantsIt }).labels).toContain("good first issue");
  });

  it("is withheld while Still to define has an open item", () => {
    const plan = planFor({
      answers: wantsIt,
      ruleGaps: stillToDefineGaps("### Still to define\n\n- [ ] A question"),
    });

    expect(plan.labels).not.toContain("good first issue");
    expect(plan.status).toBe("needs-triage");
    expect(plan.stillToDefineOpen).toBe(true);
  });

  it("is withheld while any other gap is open", () => {
    const plan = planFor({
      answers: {
        ...wantsIt,
        check_scope: { noul: 0.2, type: "noul" },
      },
    });

    expect(plan.labels).not.toContain("good first issue");
  });

  it("is withheld from a blocked issue", () => {
    const plan = planFor({
      answers: { ...wantsIt, blocked: { noul: 0.9, type: "noul" } },
    });

    expect(plan.labels).not.toContain("good first issue");
  });

  it("is removed when the workflow set it and an item opens again", () => {
    const plan = planFor({
      answers: wantsIt,
      existingLabels: ["good first issue"],
      ruleGaps: stillToDefineGaps("### Still to define\n\n- [ ] A question"),
      workflowGoodFirstIssue: true,
    });

    expect(plan.removed).toContain("good first issue");
  });

  it("removes a label a maintainer set while an item is open", () => {
    const plan = planFor({
      answers: wantsIt,
      existingLabels: ["good first issue", "help wanted"],
      ruleGaps: stillToDefineGaps("### Still to define\n\n- [ ] A question"),
      workflowGoodFirstIssue: false,
    });

    expect(plan.removed.toSorted()).toEqual([
      "good first issue",
      "help wanted",
    ]);

    expect(plan.gaps.map((gap) => gap.owner)).toContain("maintainer");
  });

  it("keeps a label a maintainer set once the list is empty", () => {
    const plan = planFor({
      answers: {
        ...wantsIt,
        check_scope: { noul: 0.2, type: "noul" },
      },
      existingLabels: ["good first issue", "help wanted"],
      workflowGoodFirstIssue: false,
    });

    expect(plan.removed).toEqual([]);
  });

  it("is never put on a pull request", () => {
    const plan = planFor({
      answers: {
        ...wantsIt,
        pr_docs: { noul: 0.9, type: "noul" },
        pr_summary: { noul: 0.9, type: "noul" },
      },
      checklist: undefined,
      kind: "pull-request",
    });

    expect(plan.labels).not.toContain("good first issue");
  });
});

describe("help wanted", () => {
  it("is never applied by the workflow", () => {
    const plan = planFor({
      answers: {
        ...settled,
        ...requestMet,
        good_first_issue: {
          choice: "good_first_issue",
          confidence: 0.99,
          type: "choice",
        },
      },
    });

    expect(plan.labels).not.toContain("help wanted");
  });
});
