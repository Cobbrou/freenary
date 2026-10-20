import { candidateNumber, NO_DUPLICATE } from "./questions";
import type { SubjectKind } from "./questions";
import {
  checklistGaps,
  decideReadiness,
  MIN_CRITERION_PROBABILITY,
  sectionGapText,
  STEPS_CRITERION,
  unmetCriteria,
} from "./readiness";
import type { Checklist, Gap, ReadinessStatus } from "./readiness";
import type { Answers } from "./subq";
import {
  AREA_LABELS,
  GROUP_PREFIXES,
  IMPACT_LEVELS,
  PRIORITY_LABELS,
  SIGNAL_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./taxonomy";
import type { AreaKey, PriorityLabel } from "./taxonomy";

export const MIN_CONFIDENCE = 0.6;
export const MIN_SIGNAL_PROBABILITY = 0.8;
export const MIN_GOOD_FIRST_ISSUE_PROBABILITY = 0.95;
export const MIN_DUPLICATE_CONFIDENCE = 0.85;

export interface PlanInput {
  readonly kind: SubjectKind;
  readonly answers: Answers;
  readonly checklist: Checklist | undefined;
  readonly ruleGaps: readonly Gap[];
  readonly refusedLabels: readonly string[];
  readonly docsExpected: boolean;
  readonly existingLabels: readonly string[];
  readonly workflowStatuses: readonly string[];
  readonly workflowPriorities: readonly string[];
  readonly workflowReproduction: boolean;
  readonly areasFromPaths: readonly AreaKey[];
}

export interface Plan {
  readonly labels: string[];
  readonly removed: string[];
  readonly duplicateOf: number | undefined;
  readonly gaps: Gap[];
  readonly status: string | undefined;
  readonly notes: string[];
}

export const SIGNAL_BY_QUESTION = {
  breaking_change: SIGNAL_LABELS.breakingChange,
  good_first_issue: SIGNAL_LABELS.goodFirstIssue,
  performance: SIGNAL_LABELS.performance,
  regression: SIGNAL_LABELS.regression,
  security: SIGNAL_LABELS.security,
} as const satisfies Record<string, string>;

const MIN_PROBABILITY_BY_QUESTION: Readonly<Record<string, number>> = {
  good_first_issue: MIN_GOOD_FIRST_ISSUE_PROBABILITY,
} satisfies Partial<Record<keyof typeof SIGNAL_BY_QUESTION, number>>;

const isKnownKey = <T extends object>(
  table: T,
  key: string
): key is Extract<keyof T, string> => Object.hasOwn(table, key);

const confidentChoice = (
  answers: Answers,
  key: string,
  notes: string[]
): string | undefined => {
  const answer = answers[key];

  if (answer?.type !== "choice") {
    notes.push(`${key}: no answer`);

    return undefined;
  }

  notes.push(`${key}: ${answer.choice} (${answer.confidence.toFixed(2)})`);

  return answer.confidence >= MIN_CONFIDENCE ? answer.choice : undefined;
};

const confidentLevel = <const Levels extends readonly string[]>(
  answers: Answers,
  key: string,
  levels: Levels,
  notes: string[]
): Levels[number] | undefined => {
  const answer = answers[key];

  if (answer?.type !== "score") {
    notes.push(`${key}: no answer`);

    return undefined;
  }

  const index = Math.min(
    Math.max(Math.round(answer.score), 0),
    levels.length - 1
  );

  notes.push(
    `${key}: ${levels[index]} (score ${answer.score.toFixed(2)}, ${answer.confidence.toFixed(2)})`
  );

  return answer.confidence >= MIN_CONFIDENCE ? levels[index] : undefined;
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
  const choice = confidentChoice(answers, "type", notes);

  return choice && isKnownKey(TYPE_LABELS, choice)
    ? TYPE_LABELS[choice]
    : undefined;
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

const TOP_ALTERNATIVES = 2;

const alternatives = (
  probabilities: Readonly<Record<string, number>> | undefined,
  labelFor: (key: string) => string | undefined
): string => {
  const ranked = Object.entries(probabilities ?? {})
    .toSorted(([, left], [, right]) => right - left)
    .flatMap(([key, probability]) => {
      const label = labelFor(key);

      return label ? [`\`${label}\` (${probability.toFixed(2)})`] : [];
    })
    .slice(0, TOP_ALTERNATIVES);

  return ranked.length > 0 ? `: ${ranked.join(" or ")}` : "";
};

const unsettledGap = (
  answers: Answers,
  key: "type" | "area" | "impact",
  refused: ReadonlySet<string>
): Gap => {
  const answer = answers[key];
  const probabilities =
    answer?.type === "choice" || answer?.type === "score"
      ? answer.probabilities
      : undefined;

  const labelFor = (option: string): string | undefined => {
    const table = key === "type" ? TYPE_LABELS : AREA_LABELS;
    const fromTable = isKnownKey(table, option) ? table[option] : undefined;
    const label = key === "impact" ? IMPACT_LEVELS[Number(option)] : fromTable;

    return label && !refused.has(label) ? label : undefined;
  };

  return {
    owner: "maintainer",
    text: `Pick the ${key}${alternatives(probabilities, labelFor)}.`,
  };
};

const STATUS_BY_READINESS = {
  blocked: STATUS_LABELS.blocked,
  "needs-info": STATUS_LABELS.needsInfo,
  "needs-triage": STATUS_LABELS.needsTriage,
  ready: STATUS_LABELS.ready,
} as const satisfies Record<ReadinessStatus, string>;

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

const planAreas = (input: PlanInput, notes: string[]): string[] => {
  const choice = confidentChoice(input.answers, "area", notes);
  const fromModel = choice && isKnownKey(AREA_LABELS, choice) ? [choice] : [];
  const areas =
    input.areasFromPaths.length > 0 ? input.areasFromPaths : fromModel;

  return areas.map((area) => AREA_LABELS[area]);
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
  "impact:critical": PRIORITY_LABELS.p0,
  "impact:high": PRIORITY_LABELS.p1,
  "impact:low": PRIORITY_LABELS.p3,
  "impact:medium": PRIORITY_LABELS.p2,
} as const satisfies Record<(typeof IMPACT_LEVELS)[number], PriorityLabel>;

export const derivePriority = (
  impact: string | undefined,
  signals: readonly string[]
): PriorityLabel | undefined => {
  if (signals.includes(SIGNAL_LABELS.security)) {
    return PRIORITY_LABELS.p0;
  }

  const fromImpact =
    impact && isKnownKey(PRIORITY_BY_IMPACT, impact)
      ? PRIORITY_BY_IMPACT[impact]
      : undefined;

  if (
    signals.includes(SIGNAL_LABELS.regression) &&
    fromImpact !== PRIORITY_LABELS.p0
  ) {
    return PRIORITY_LABELS.p1;
  }

  return fromImpact;
};

const planSignals = (
  input: PlanInput,
  unmet: readonly string[],
  notes: string[]
): string[] => {
  const signals: string[] = Object.entries(SIGNAL_BY_QUESTION).flatMap(
    ([question, label]) =>
      isYes(input.answers, question, notes) ? [label] : []
  );

  if (input.checklist === "bug" && unmet.includes(STEPS_CRITERION)) {
    signals.push(SIGNAL_LABELS.needsReproduction);
  }

  return signals;
};

const planRemovals = (
  input: PlanInput,
  planned: {
    readonly status: string | undefined;
    readonly priority: string | undefined;
  },
  unmet: readonly string[],
  settledType: string | undefined
): string[] => {
  const stepsWritten =
    input.checklist === "bug" && !unmet.includes(STEPS_CRITERION);

  const noLongerBug =
    settledType !== undefined && settledType !== TYPE_LABELS.bug;

  return [
    ...input.workflowStatuses.filter((label) => label !== planned.status),
    ...input.workflowPriorities.filter((label) => label !== planned.priority),
    ...(input.workflowReproduction && (stepsWritten || noLongerBug)
      ? [SIGNAL_LABELS.needsReproduction]
      : []),
  ];
};

const SETTLED_GROUPS = ["type", "area", "impact"] as const;

type SettledGroup = (typeof SETTLED_GROUPS)[number];

interface GapSources {
  readonly refused: ReadonlySet<string>;
  readonly unsettled: readonly SettledGroup[];
  readonly unmet: readonly string[];
  readonly duplicateOf: number | undefined;
  readonly settledType: string | undefined;
}

const collectGaps = (input: PlanInput, sources: GapSources): Gap[] => [
  ...sources.unsettled.map((group) =>
    unsettledGap(input.answers, group, sources.refused)
  ),
  ...(sources.settledType === TYPE_LABELS.question
    ? [{ owner: "maintainer" as const, text: "Answer the question." }]
    : []),
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

export const planLabels = (input: PlanInput): Plan => {
  const notes: string[] = [];
  const existing = input.existingLabels.filter(
    (label) =>
      !input.workflowStatuses.includes(label) &&
      !input.workflowPriorities.includes(label)
  );

  const labels: string[] = [];
  const refused = new Set(
    input.refusedLabels.filter(
      (label) => !label.startsWith(GROUP_PREFIXES.status)
    )
  );

  const allowed = (label: string | undefined): string | undefined =>
    label !== undefined && !refused.has(label) ? label : undefined;

  const type = allowed(planType(input.answers, notes));
  const areas = planAreas(input, notes).filter((area) => allowed(area));
  const impact = allowed(
    confidentLevel(input.answers, "impact", IMPACT_LEVELS, notes)
  );

  const unmet = input.checklist
    ? unmetCriteria(input.checklist, input.answers)
    : [];

  notes.push(
    `checklist ${input.checklist ?? "none"}: ${unmet.join(", ") || "all met"}`
  );

  const signals = planSignals(input, unmet, notes).filter((signal) =>
    allowed(signal)
  );

  const settledImpact =
    existing.find((label) => label.startsWith(GROUP_PREFIXES.impact)) ?? impact;

  const priority = derivePriority(settledImpact, [...existing, ...signals]);

  notes.push(
    hasGroup(existing, GROUP_PREFIXES.priority)
      ? "priority: kept the existing label"
      : `priority: ${priority ?? "none"} (from impact and signals)`
  );

  const grouped: readonly (readonly [string, readonly string[]])[] = [
    [GROUP_PREFIXES.type, type ? [type] : []],
    [GROUP_PREFIXES.area, areas],
    [GROUP_PREFIXES.priority, priority ? [priority] : []],
    [GROUP_PREFIXES.impact, impact ? [impact] : []],
  ];

  for (const [prefix, candidates] of grouped) {
    if (!hasGroup(existing, prefix)) {
      labels.push(...candidates);
    }
  }

  const candidatesByGroup = {
    area: areas,
    impact: impact ? [impact] : [],
    type: type ? [type] : [],
  } as const;

  const unsettled = SETTLED_GROUPS.filter(
    (group) =>
      candidatesByGroup[group].length === 0 &&
      !hasGroup(existing, GROUP_PREFIXES[group])
  );

  const duplicateOf = allowed(SIGNAL_LABELS.duplicate)
    ? planDuplicate(input.answers, notes)
    : undefined;

  const settledType = resolveTypeLabel(input.answers, existing, [...refused]);
  const gaps = collectGaps(input, {
    duplicateOf,
    refused,
    settledType,
    unmet,
    unsettled,
  });

  const blocked = isYes(input.answers, "blocked", notes);
  const readiness = decideReadiness(blocked, gaps);

  notes.push(`readiness: ${readiness}`);

  const status = hasGroup(existing, GROUP_PREFIXES.status)
    ? undefined
    : STATUS_BY_READINESS[readiness];

  if (status) {
    labels.push(status);
  }

  const removed = planRemovals(
    input,
    {
      priority: hasGroup(existing, GROUP_PREFIXES.priority)
        ? undefined
        : priority,
      status,
    },
    unmet,
    settledType
  );

  labels.push(...signals);

  if (duplicateOf !== undefined) {
    labels.push(SIGNAL_LABELS.duplicate);
  }

  const added = [...new Set(labels)].filter(
    (label) => !input.existingLabels.includes(label) && !refused.has(label)
  );

  return { duplicateOf, gaps, labels: added, notes, removed, status };
};
