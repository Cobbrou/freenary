import { candidateNumber, NO_DUPLICATE } from "./questions";
import type { Answers } from "./subq";
import {
  AREA_LABELS,
  GROUP_PREFIXES,
  IMPACT_LEVELS,
  PRIORITY_LEVELS,
  SIGNAL_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./taxonomy";
import type { AreaKey } from "./taxonomy";

export const MIN_CONFIDENCE = 0.6;
export const MIN_SIGNAL_PROBABILITY = 0.8;
export const MIN_DUPLICATE_CONFIDENCE = 0.85;

export interface PlanInput {
  readonly answers: Answers;
  readonly existingLabels: readonly string[];
  readonly areasFromPaths: readonly AreaKey[];
}

export interface Plan {
  readonly labels: string[];
  readonly duplicateOf: number | undefined;
  readonly notes: string[];
}

const SIGNAL_BY_QUESTION: Readonly<Record<string, string>> = {
  breaking_change: SIGNAL_LABELS.breakingChange,
  good_first_issue: SIGNAL_LABELS.goodFirstIssue,
  needs_reproduction: SIGNAL_LABELS.needsReproduction,
  performance: SIGNAL_LABELS.performance,
  regression: SIGNAL_LABELS.regression,
  security: SIGNAL_LABELS.security,
};

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

  return answer.noul >= MIN_SIGNAL_PROBABILITY;
};

const hasGroup = (labels: readonly string[], prefix: string): boolean =>
  labels.some((label) => label.startsWith(prefix));

const planType = (input: PlanInput, notes: string[]): string | undefined => {
  const choice = confidentChoice(input.answers, "type", notes);

  return choice && isKnownKey(TYPE_LABELS, choice)
    ? TYPE_LABELS[choice]
    : undefined;
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

const planStatus = (
  answers: Answers,
  everyGroupConfident: boolean,
  notes: string[]
): string => {
  if (isYes(answers, "blocked", notes)) {
    return STATUS_LABELS.blocked;
  }

  if (isYes(answers, "needs_info", notes)) {
    return STATUS_LABELS.needsInfo;
  }

  const ready = isYes(answers, "ready", notes);

  return ready && everyGroupConfident
    ? STATUS_LABELS.ready
    : STATUS_LABELS.needsTriage;
};

export const planLabels = (input: PlanInput): Plan => {
  const notes: string[] = [];
  const existing = input.existingLabels;
  const labels: string[] = [];

  const type = planType(input, notes);
  const areas = planAreas(input, notes);
  const priority = confidentLevel(
    input.answers,
    "priority",
    PRIORITY_LEVELS,
    notes
  );

  const impact = confidentLevel(input.answers, "impact", IMPACT_LEVELS, notes);

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

  const everyGroupConfident = grouped.every(
    ([prefix, candidates]) =>
      candidates.length > 0 || hasGroup(existing, prefix)
  );

  if (!hasGroup(existing, GROUP_PREFIXES.status)) {
    labels.push(planStatus(input.answers, everyGroupConfident, notes));
  }

  const isBug =
    existing.includes(TYPE_LABELS.bug) ||
    (!hasGroup(existing, GROUP_PREFIXES.type) && type === TYPE_LABELS.bug);

  for (const [question, label] of Object.entries(SIGNAL_BY_QUESTION)) {
    const appliesToType = label !== SIGNAL_LABELS.needsReproduction || isBug;

    if (appliesToType && isYes(input.answers, question, notes)) {
      labels.push(label);
    }
  }

  const duplicateOf = planDuplicate(input.answers, notes);

  if (duplicateOf !== undefined) {
    labels.push(SIGNAL_LABELS.duplicate);
  }

  const added = [...new Set(labels)].filter(
    (label) => !existing.includes(label)
  );

  return { duplicateOf, labels: added, notes };
};
