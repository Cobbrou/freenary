import { describe, expect, it } from "bun:test";

import {
  blindSamples,
  measureAgreement,
  renderTable,
  samplesFor,
} from "./calibration";

describe("samplesFor", () => {
  it("compares each answer with the labels a maintainer kept", () => {
    const samples = samplesFor(
      {
        good_first_issue: { noul: 0.1, type: "noul" },
        impact: { confidence: 0.7, score: 0.2, type: "score" },
        type: { choice: "feature", confidence: 0.6, type: "choice" },
      },
      {
        labels: ["type: maintenance", "impact: low"],
      }
    );

    expect(samples).toEqual([
      { confidence: 0.6, kind: "label", matches: false, question: "type" },
      { confidence: 0.7, kind: "label", matches: true, question: "impact" },
      {
        kind: "signal",
        present: false,
        probability: 0.1,
        question: "good_first_issue",
      },
    ]);
  });

  it("skips a group the maintainer left empty", () => {
    expect(
      samplesFor(
        { type: { choice: "bug", confidence: 0.9, type: "choice" } },
        { labels: [] }
      )
    ).toEqual([]);
  });
});

describe("measureAgreement", () => {
  it("counts only confident label answers and every signal answer", () => {
    const rows = measureAgreement([
      { confidence: 0.55, kind: "label", matches: false, question: "type" },
      { confidence: 0.9, kind: "label", matches: true, question: "type" },
      {
        kind: "signal",
        present: true,
        probability: 0.85,
        question: "good_first_issue",
      },
      {
        kind: "signal",
        present: false,
        probability: 0.75,
        question: "good_first_issue",
      },
    ]);

    const at = (question: string, threshold: number) =>
      rows.find(
        (row) => row.question === question && row.threshold === threshold
      );

    expect(at("type", 0.5)).toMatchObject({ agreement: 0.5, covered: 2 });
    expect(at("type", 0.6)).toMatchObject({ agreement: 1, covered: 1 });
    expect(at("good_first_issue", 0.7)).toMatchObject({
      agreement: 0.5,
      covered: 2,
    });

    expect(at("good_first_issue", 0.8)).toMatchObject({
      agreement: 1,
      covered: 2,
    });

    expect(renderTable(rows)).toContain(
      "| good_first_issue | 0.80 | 2 | 1.00 |"
    );
  });
});

describe("blindSamples", () => {
  it("skips a run whose input already carried the answer", () => {
    const item = {
      labels: ["type: bug", "impact: low"],
    };

    const samples = blindSamples(
      [
        {
          answers: {
            impact: { confidence: 0.7, score: 2, type: "score" },
            type: { choice: "feature", confidence: 0.7, type: "choice" },
          },
          existingLabels: [],
          recordedAt: "2026-10-01T00:00:00Z",
        },
        {
          answers: {
            impact: { confidence: 0.9, score: 0, type: "score" },
            type: { choice: "bug", confidence: 0.9, type: "choice" },
          },
          existingLabels: ["type: bug", "impact: low", "priority: low"],
          recordedAt: "2026-10-02T00:00:00Z",
        },
      ],
      item
    );

    expect(samples).toEqual([
      { confidence: 0.7, kind: "label", matches: false, question: "type" },
      { confidence: 0.7, kind: "label", matches: false, question: "impact" },
    ]);
  });
});
