import { describe, expect, it } from "bun:test";

import { areasForPaths } from "./areas";
import { planLabels } from "./plan";
import { buildQuestions } from "./questions";
import type { Answers } from "./subq";
import { LABELS } from "./taxonomy";

const confidentBug: Answers = {
  area: { choice: "frontend", confidence: 0.9, type: "choice" },
  blocked: { noul: 0.05, type: "noul" },
  impact: { confidence: 0.8, score: 2.2, type: "score" },
  needs_info: { noul: 0.1, type: "noul" },
  priority: { confidence: 0.7, score: 1.4, type: "score" },
  ready: { noul: 0.9, type: "noul" },
  regression: { noul: 0.95, type: "noul" },
  security: { noul: 0.2, type: "noul" },
  type: { choice: "bug", confidence: 0.95, type: "choice" },
};

describe("planLabels", () => {
  it("labels every group of a confident answer set", () => {
    const plan = planLabels({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: [],
    });

    expect(plan.labels.toSorted()).toEqual(
      [
        "area:frontend",
        "impact:high",
        "priority:p2",
        "regression",
        "status:ready",
        "type:bug",
      ].toSorted()
    );
  });

  it("holds a low-confidence group back and marks the item for triage", () => {
    const plan = planLabels({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: [],
    });

    expect(plan.labels).not.toContain("type:bug");
    expect(plan.labels).toContain("status:needs-triage");
  });

  it("never overrides a group a maintainer already labelled", () => {
    const plan = planLabels({
      answers: confidentBug,
      areasFromPaths: [],
      existingLabels: ["type:feature", "status:blocked"],
    });

    expect(plan.labels).not.toContain("type:bug");
    expect(plan.labels.some((label) => label.startsWith("status:"))).toBe(
      false
    );
  });

  it("prefers the areas of changed files over the model", () => {
    const plan = planLabels({
      answers: confidentBug,
      areasFromPaths: ["database", "docs"],
      existingLabels: [],
    });

    expect(plan.labels).toContain("area:database");
    expect(plan.labels).toContain("area:docs");
    expect(plan.labels).not.toContain("area:frontend");
  });

  it("flags a confident duplicate", () => {
    const plan = planLabels({
      answers: {
        ...confidentBug,
        duplicate: { choice: "item-14", confidence: 0.9, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: [],
    });

    expect(plan.duplicateOf).toBe(14);
    expect(plan.labels).toContain("duplicate");
  });

  it("puts needs-reproduction on bugs alone", () => {
    const answers: Answers = {
      ...confidentBug,
      needs_reproduction: { noul: 0.95, type: "noul" },
    };

    expect(
      planLabels({ answers, areasFromPaths: [], existingLabels: [] }).labels
    ).toContain("needs-reproduction");

    expect(
      planLabels({
        answers: {
          ...answers,
          type: { choice: "feature", confidence: 0.9, type: "choice" },
        },
        areasFromPaths: [],
        existingLabels: [],
      }).labels
    ).not.toContain("needs-reproduction");
  });

  it("counts a group a maintainer labelled as settled", () => {
    const plan = planLabels({
      answers: {
        ...confidentBug,
        type: { choice: "bug", confidence: 0.3, type: "choice" },
      },
      areasFromPaths: [],
      existingLabels: ["type:feature"],
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

  it("asks pull requests no reproduction or newcomer question", () => {
    const questions = buildQuestions("pull-request", []);

    expect(questions.needs_reproduction).toBeUndefined();
    expect(questions.good_first_issue).toBeUndefined();
  });
});

describe("taxonomy", () => {
  it("defines every label once", () => {
    const names = LABELS.map((label) => label.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(33);
  });
});
