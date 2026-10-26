import { candidateNumber, NO_DUPLICATE } from "./questions";
import type { SubjectKind } from "./questions";
import {
  checklistGaps,
  decideReadiness,
  MIN_CRITERION_PROBABILITY,
  sectionGapText,
  STILL_TO_DEFINE_GAP_TEXT,
  unmetCriteria,
} from "./readiness";
import type { Checklist, Gap, ReadinessStatus } from "./readiness";
import type { Answers } from "./subq";
import {
  GOOD_FIRST_ISSUE_LABEL,
  GROUP_PREFIXES,
  HELP_WANTED_LABEL,
  IMPACT_LEVELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
} from "./taxonomy";
import type { PriorityLabel } from "./taxonomy";

export const MIN_SIGNAL_PROBABILITY = 0.8;
export const MIN_GOOD_FIRST_ISSUE_PROBABILITY = 0.95;
export const MIN_IMPACT_CONFIDENCE = 0.8;
export const MIN_DUPLICATE_CONFIDENCE = 0.85;

export interface PlanInput {
  readonly kind: SubjectKind;
  readonly answers: Answers;
  readonly checklist: Checklist | undefined;
  readonly ruleGaps: readonly Gap[];
  readonly refusedLabels: readonly string[];
  readonly docsExpected: boolean;
  readonly existingLabels: readonly string[];
  readonly workflowPriorities: readonly string[];
  readonly workflowGoodFirstIssue: boolean;
}

export interface Plan {
  readonly labels: string[];
  readonly removed: string[];
  readonly duplicateOf: number | undefined;
  readonly gaps: Gap[];
  readonly status: ReadinessStatus;
  readonly notes: string[];
  readonly stillToDefineOpen: boolean;
}

const SECURITY_SIGNAL = "security";
const REGRESSION_SIGNAL = "regression";

const SIGNAL_QUESTIONS = {
  regression: REGRESSION_SIGNAL,
  security: SECURITY_SIGNAL,
} as const satisfies Record<string, string>;

const MIN_PROBABILITY_BY_QUESTION: Readonly<Record<string, number>> = {
  good_first_issue: MIN_GOOD_FIRST_ISSUE_PROBABILITY,
};

const isKnownKey = <T extends object>(
  table: T,
  key: string
): key is Extract<keyof T, string> => Object.hasOwn(table, key);

type TypeKey = keyof typeof TYPE_LABELS;

export const TYPE_TIE_ORDER = [
  "bug",
  "documentation",
  "feature",
  "maintenance",
] as const satisfies readonly TypeKey[];

export const IMPACT_TIE_ORDER = IMPACT_LEVELS.toReversed();

const roundHalfUp: (score: number) => number = Math.round;

interface RankedOption<Option extends string> {
  readonly option: Option;
  readonly probability: number;
}

const rankOptions = <Option extends string>(
  probabilityOf: (option: Option) => number | undefined,
  tieOrder: readonly Option[]
): RankedOption<Option>[] =>
  tieOrder
    .flatMap((option) => {
      const probability = probabilityOf(option);

      return probability === undefined ? [] : [{ option, probability }];
    })
    .toSorted((left, right) => right.probability - left.probability);

const runnerUpText = <Option extends string>(
  ranked: readonly RankedOption<Option>[],
  top: Option
): string => {
  const runnerUp = ranked.find((entry) => entry.option !== top);

  return runnerUp
    ? `; next ${runnerUp.option} ${runnerUp.probability.toFixed(2)}`
    : "";
};

const topChoice = <Option extends string>(
  answers: Answers,
  key: string,
  tieOrder: readonly Option[],
  notes: string[]
): Option | undefined => {
  const answer = answers[key];

  if (answer?.type !== "choice") {
    notes.push(`${key}: no answer`);

    return undefined;
  }

  const ranked = rankOptions(
    (option) => answer.probabilities?.[option],
    tieOrder
  );

  const [leader] = ranked;
  const stated = tieOrder.find((option) => option === answer.choice);
  const statedTiesLeader =
    leader !== undefined &&
    stated !== undefined &&
    answer.probabilities?.[stated] === leader.probability;

  const top =
    stated === undefined || statedTiesLeader ? leader?.option : stated;

  if (top === undefined) {
    notes.push(`${key}: no answer`);

    return undefined;
  }

  const confidence =
    top === stated ? answer.confidence : (leader?.probability ?? 0);

  notes.push(
    `${key}: ${top} (${confidence.toFixed(2)}${runnerUpText(ranked, top)})`
  );

  return top;
};

const topImpact = (
  answers: Answers,
  notes: string[]
): (typeof IMPACT_LEVELS)[number] | undefined => {
  const answer = answers.impact;

  if (answer?.type !== "score") {
    notes.push("impact: no answer");

    return undefined;
  }

  const index = Math.min(
    Math.max(roundHalfUp(answer.score), 0),
    IMPACT_LEVELS.length - 1
  );

  const top = IMPACT_LEVELS[index] ?? IMPACT_LEVELS[0];
  const ranked = rankOptions(
    (level) => answer.probabilities?.[String(IMPACT_LEVELS.indexOf(level))],
    IMPACT_TIE_ORDER
  );

  const detail = `score ${answer.score.toFixed(2)}, ${answer.confidence.toFixed(2)}${runnerUpText(ranked, top)}`;

  if (answer.confidence < MIN_IMPACT_CONFIDENCE) {
    notes.push(`impact: none, too uncertain (${top}; ${detail})`);

    return undefined;
  }

  notes.push(`impact: ${top} (${detail})`);

  return top;
};

const isYes = (answers: Answers, key: string, notes: string[]): boolean => {
  const answer = answers[key];

  if (answer?.type !== "noul") {
    return false;
  }

  notes.push(`${key}: ${answer.noul.toFixed(2)}`);

  return (
    answer.noul >= (MIN_PROBABILITY_BY_QUESTION[key] ?? MIN_SIGNAL_PROBABILITY)
  );
};

const hasGroup = (labels: readonly string[], prefix: string): boolean =>
  labels.some((label) => label.startsWith(prefix));

const planType = (answers: Answers, notes: string[]): string | undefined => {
  const choice = topChoice(answers, "type", TYPE_TIE_ORDER, notes);

  return choice ? TYPE_LABELS[choice] : undefined;
};

export const resolveTypeLabel = (
  answers: Answers,
  existingLabels: readonly string[],
  refusedLabels: readonly string[]
): string | undefined => {
  const modelType = planType(answers, []);

  return (
    existingLabels.find((label) => label.startsWith(GROUP_PREFIXES.type)) ??
    (modelType && !refusedLabels.includes(modelType) ? modelType : undefined)
  );
};

const isMet = (answers: Answers, key: string): boolean => {
  const answer = answers[key];

  return answer?.type === "noul" && answer.noul >= MIN_CRITERION_PROBABILITY;
};

const pullRequestGaps = (input: PlanInput): Gap[] => {
  const gaps: Gap[] = [];

  const summaryFlagged = input.ruleGaps.some(
    (gap) => gap.text === sectionGapText("Summary")
  );

  if (!summaryFlagged && !isMet(input.answers, "pr_summary")) {
    gaps.push({
      owner: "author",
      text: "Write a Summary that says what changed and what to review first.",
    });
  }

  if (input.docsExpected && !isMet(input.answers, "pr_docs")) {
    gaps.push({
      owner: "author",
      text: "Name the documentation pages you updated, or say in the Notes why none needed a change.",
    });
  }

  return gaps;
};

const planDuplicate = (
  answers: Answers,
  notes: string[]
): number | undefined => {
  const answer = answers.duplicate;

  if (answer?.type !== "choice" || answer.choice === NO_DUPLICATE) {
    return undefined;
  }

  notes.push(`duplicate: ${answer.choice} (${answer.confidence.toFixed(2)})`);

  return answer.confidence >= MIN_DUPLICATE_CONFIDENCE
    ? candidateNumber(answer.choice)
    : undefined;
};

const PRIORITY_BY_IMPACT = {
  "impact: high": PRIORITY_LABELS.high,
  "impact: low": PRIORITY_LABELS.low,
  "impact: medium": PRIORITY_LABELS.medium,
} as const satisfies Record<(typeof IMPACT_LEVELS)[number], PriorityLabel>;

const RAISED_PRIORITY = {
  [PRIORITY_LABELS.high]: PRIORITY_LABELS.high,
  [PRIORITY_LABELS.low]: PRIORITY_LABELS.medium,
  [PRIORITY_LABELS.medium]: PRIORITY_LABELS.high,
} as const satisfies Record<PriorityLabel, PriorityLabel>;

export const derivePriority = (
  impact: string | undefined,
  signals: readonly string[]
): PriorityLabel | undefined => {
  if (signals.includes(SECURITY_SIGNAL)) {
    return PRIORITY_LABELS.high;
  }

  const fromImpact =
    impact && isKnownKey(PRIORITY_BY_IMPACT, impact)
      ? PRIORITY_BY_IMPACT[impact]
      : undefined;

  return fromImpact && signals.includes(REGRESSION_SIGNAL)
    ? RAISED_PRIORITY[fromImpact]
    : fromImpact;
};

const planSignals = (input: PlanInput, notes: string[]): string[] =>
  Object.entries(SIGNAL_QUESTIONS).flatMap(([question, signal]) =>
    isYes(input.answers, question, notes) ? [signal] : []
  );

interface GapSources {
  readonly duplicateOf: number | undefined;
  readonly unmet: readonly string[];
}

const collectGaps = (input: PlanInput, sources: GapSources): Gap[] => [
  ...(input.checklist ? checklistGaps(input.checklist, sources.unmet) : []),
  ...(input.kind === "pull-request" ? pullRequestGaps(input) : []),
  ...input.ruleGaps,
  ...(sources.duplicateOf === undefined
    ? []
    : [
        {
          owner: "maintainer" as const,
          text: `Check whether this duplicates #${sources.duplicateOf}.`,
        },
      ]),
];

interface ImpactPlan {
  readonly impact: string | undefined;
  readonly priority: string | undefined;
}

const planImpactAndPriority = (
  input: PlanInput,
  existing: readonly string[],
  isAllowed: (label: string | undefined) => string | undefined,
  notes: string[]
): ImpactPlan => {
  if (input.kind !== "issue") {
    return { impact: undefined, priority: undefined };
  }

  const impact = isAllowed(topImpact(input.answers, notes));
  const settledImpact =
    existing.find((label) => label.startsWith(GROUP_PREFIXES.impact)) ?? impact;

  const priority = isAllowed(
    derivePriority(settledImpact, planSignals(input, notes))
  );

  notes.push(
    hasGroup(existing, GROUP_PREFIXES.priority)
      ? "priority: kept the existing label"
      : `priority: ${priority ?? "none"} (from a confident impact or a security or regression signal)`
  );

  return { impact, priority };
};

const removedContributorLabels = (
  input: PlanInput,
  specComplete: boolean,
  stillToDefineOpen: boolean
): string[] => {
  if (stillToDefineOpen) {
    return [GOOD_FIRST_ISSUE_LABEL, HELP_WANTED_LABEL].filter((label) =>
      input.existingLabels.includes(label)
    );
  }

  return input.workflowGoodFirstIssue && !specComplete
    ? [GOOD_FIRST_ISSUE_LABEL]
    : [];
};

export const planLabels = (input: PlanInput): Plan => {
  const notes: string[] = [];
  const isIssue = input.kind === "issue";
  const existing = input.existingLabels.filter(
    (label) => !input.workflowPriorities.includes(label)
  );

  const labels: string[] = [];
  const refused = new Set(input.refusedLabels);

  const allowed = (label: string | undefined): string | undefined =>
    label !== undefined && !refused.has(label) ? label : undefined;

  const type = allowed(planType(input.answers, notes));
  const { impact, priority } = planImpactAndPriority(
    input,
    existing,
    allowed,
    notes
  );

  const unmet = input.checklist
    ? unmetCriteria(input.checklist, input.answers)
    : [];

  notes.push(
    `checklist ${input.checklist ?? "none"}: ${unmet.join(", ") || "all met"}`
  );

  const grouped: readonly (readonly [string, readonly string[]])[] = [
    [GROUP_PREFIXES.type, type ? [type] : []],
    [GROUP_PREFIXES.priority, priority ? [priority] : []],
    [GROUP_PREFIXES.impact, impact ? [impact] : []],
  ];

  for (const [prefix, candidates] of grouped) {
    if (!hasGroup(existing, prefix)) {
      labels.push(...candidates);
    }
  }

  const duplicateOf = planDuplicate(input.answers, notes);
  const gaps = collectGaps(input, { duplicateOf, unmet });
  const blocked = isYes(input.answers, "blocked", notes);
  const status = decideReadiness(blocked, gaps);

  notes.push(`readiness: ${status}`);

  const specComplete = status === "ready";

  if (isIssue && isYes(input.answers, "good_first_issue", notes)) {
    if (specComplete) {
      labels.push(GOOD_FIRST_ISSUE_LABEL);
    } else {
      notes.push("good first issue: withheld until the spec is complete");
    }
  }

  const settledPriority = hasGroup(existing, GROUP_PREFIXES.priority)
    ? undefined
    : priority;

  const stillToDefineOpen = input.ruleGaps.some(
    (gap) => gap.text === STILL_TO_DEFINE_GAP_TEXT
  );

  const removed = [
    ...input.workflowPriorities.filter((label) => label !== settledPriority),
    ...removedContributorLabels(input, specComplete, stillToDefineOpen),
  ];

  const added = [...new Set(labels)].filter(
    (label) => !input.existingLabels.includes(label) && !refused.has(label)
  );

  return {
    duplicateOf,
    gaps,
    labels: added,
    notes,
    removed,
    status,
    stillToDefineOpen,
  };
};
