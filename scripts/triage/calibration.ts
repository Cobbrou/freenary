import {
  GOOD_FIRST_ISSUE_TIE_ORDER,
  rankedImpact,
  rankedTop,
  TYPE_TIE_ORDER,
} from "./plan";
import { GOOD_FIRST_ISSUE_CHOICE } from "./questions";
import type { Answers } from "./subq";
import {
  GOOD_FIRST_ISSUE_LABEL,
  GROUP_PREFIXES,
  TYPE_LABELS,
} from "./taxonomy";

export type Sample =
  | {
      readonly kind: "label";
      readonly question: string;
      readonly confidence: number;
      readonly matches: boolean;
    }
  | {
      readonly kind: "signal";
      readonly question: string;
      readonly probability: number;
      readonly present: boolean;
    };

export interface ThresholdRow {
  readonly question: string;
  readonly threshold: number;
  readonly covered: number;
  readonly agreement: number | undefined;
}

export const THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95] as const;

export interface ReviewedItem {
  readonly labels: readonly string[];
}

const GOOD_FIRST_ISSUE_QUESTION = "good_first_issue";
const LEGACY_GOOD_FIRST_ISSUE_QUESTION = "good_first_issue (noul)";

const groupLabel = (
  labels: readonly string[],
  prefix: string
): string | undefined => labels.find((label) => label.startsWith(prefix));

const typeSample = (answers: Answers, labels: readonly string[]): Sample[] => {
  const answer = answers.type;

  if (answer?.type !== "choice" || !groupLabel(labels, GROUP_PREFIXES.type)) {
    return [];
  }

  const selection = rankedTop(answer, TYPE_TIE_ORDER);

  return selection
    ? [
        {
          confidence: selection.probability,
          kind: "label",
          matches: labels.includes(TYPE_LABELS[selection.top]),
          question: "type",
        },
      ]
    : [];
};

const impactSample = (
  answers: Answers,
  labels: readonly string[]
): Sample[] => {
  const answer = answers.impact;
  const actual = groupLabel(labels, GROUP_PREFIXES.impact);
  const selection =
    answer?.type === "score" && actual ? rankedImpact(answer) : undefined;

  return selection
    ? [
        {
          confidence: selection.probability,
          kind: "label",
          matches: selection.top === actual,
          question: "impact",
        },
      ]
    : [];
};

const goodFirstIssueSample = (
  answers: Answers,
  labels: readonly string[]
): Sample[] => {
  const answer = answers[GOOD_FIRST_ISSUE_QUESTION];
  const present = labels.includes(GOOD_FIRST_ISSUE_LABEL);

  if (answer?.type === "noul") {
    return [
      {
        kind: "signal",
        present,
        probability: answer.noul,
        question: LEGACY_GOOD_FIRST_ISSUE_QUESTION,
      },
    ];
  }

  const selection =
    answer?.type === "choice"
      ? rankedTop(answer, GOOD_FIRST_ISSUE_TIE_ORDER)
      : undefined;

  return selection
    ? [
        {
          confidence: selection.probability,
          kind: "label",
          matches: (selection.top === GOOD_FIRST_ISSUE_CHOICE) === present,
          question: GOOD_FIRST_ISSUE_QUESTION,
        },
      ]
    : [];
};

export const samplesFor = (answers: Answers, item: ReviewedItem): Sample[] => [
  ...typeSample(answers, item.labels),
  ...impactSample(answers, item.labels),
  ...goodFirstIssueSample(answers, item.labels),
];

const rowFor = (
  question: string,
  threshold: number,
  ofQuestion: readonly Sample[]
): ThresholdRow => {
  const outcomes = ofQuestion.flatMap((sample) => {
    if (sample.kind === "signal") {
      return [sample.probability >= threshold === sample.present];
    }

    return sample.confidence >= threshold ? [sample.matches] : [];
  });

  const agreeing = outcomes.filter(Boolean).length;

  return {
    agreement: outcomes.length > 0 ? agreeing / outcomes.length : undefined,
    covered: outcomes.length,
    question,
    threshold,
  };
};

export const measureAgreement = (
  samples: readonly Sample[]
): ThresholdRow[] => {
  const questions = [...new Set(samples.map((sample) => sample.question))];

  return questions.toSorted().flatMap((question) => {
    const ofQuestion = samples.filter((sample) => sample.question === question);

    return THRESHOLDS.map((threshold) =>
      rowFor(question, threshold, ofQuestion)
    );
  });
};

export const renderTable = (rows: readonly ThresholdRow[]): string =>
  [
    "| Question | Threshold | Items | Agreement |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.question} | ${row.threshold.toFixed(2)} | ${row.covered} | ${
          row.agreement === undefined ? "–" : row.agreement.toFixed(2)
        } |`
    ),
  ].join("\n");

export interface RecordedRun {
  readonly answers: Answers;
  readonly existingLabels: readonly string[];
  readonly recordedAt: string;
}

const PREFIX_BY_QUESTION: Readonly<Record<string, string>> = {
  impact: GROUP_PREFIXES.impact,
  type: GROUP_PREFIXES.type,
};

const inputCarriedAnswer = (
  existingLabels: readonly string[],
  question: string
): boolean => {
  const prefix = PREFIX_BY_QUESTION[question];

  if (prefix !== undefined) {
    return existingLabels.some((label) => label.startsWith(prefix));
  }

  return (
    (question === GOOD_FIRST_ISSUE_QUESTION ||
      question === LEGACY_GOOD_FIRST_ISSUE_QUESTION) &&
    existingLabels.includes(GOOD_FIRST_ISSUE_LABEL)
  );
};

export const blindSamples = (
  runs: readonly RecordedRun[],
  item: ReviewedItem
): Sample[] => {
  const byQuestion = new Map<string, Sample>();
  const newestFirst = runs.toSorted((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt)
  );

  for (const run of newestFirst) {
    for (const sample of samplesFor(run.answers, item)) {
      if (
        !byQuestion.has(sample.question) &&
        !inputCarriedAnswer(run.existingLabels, sample.question)
      ) {
        byQuestion.set(sample.question, sample);
      }
    }
  }

  return [...byQuestion.values()];
};
