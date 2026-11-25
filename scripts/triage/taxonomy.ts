export interface LabelDefinition {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

export const TYPE_KEYS = [
  "bug",
  "documentation",
  "feature",
  "maintenance",
] as const;

export type TypeKey = (typeof TYPE_KEYS)[number];

export const DOCUMENTATION_LABEL = "documentation";

export const ISSUE_TYPES = {
  bug: "Bug",
  documentation: "Task",
  feature: "Feature",
  maintenance: "Task",
} as const satisfies Record<TypeKey, string>;

export const typesOfIssueType = (name: string): TypeKey[] =>
  TYPE_KEYS.filter((key) => ISSUE_TYPES[key] === name);

export const typeOfIssue = (
  issueType: string | undefined,
  labels: readonly string[]
): TypeKey | undefined => {
  const keys = issueType === undefined ? [] : typesOfIssueType(issueType);

  if (keys.length > 1) {
    return labels.includes(DOCUMENTATION_LABEL)
      ? "documentation"
      : "maintenance";
  }

  return keys[0];
};

export const PRIORITY_LABELS = {
  high: "priority: high",
  low: "priority: low",
  medium: "priority: medium",
} as const;

export type PriorityLabel =
  (typeof PRIORITY_LABELS)[keyof typeof PRIORITY_LABELS];

export const IMPACT_LEVELS = [
  "impact: low",
  "impact: medium",
  "impact: high",
] as const;

export const GOOD_FIRST_ISSUE_LABEL = "good first issue";
export const HELP_WANTED_LABEL = "help wanted";

export const GROUP_PREFIXES = {
  impact: "impact:",
  priority: "priority:",
} as const;

export const LABELS: readonly LabelDefinition[] = [
  {
    color: "0075ca",
    description: "A Task issue about the documentation site, README or guides",
    name: DOCUMENTATION_LABEL,
  },
  {
    color: "b60205",
    description: "Do this first: the next release",
    name: PRIORITY_LABELS.high,
  },
  {
    color: "fbca04",
    description: "Normal: an upcoming release",
    name: PRIORITY_LABELS.medium,
  },
  {
    color: "c2e0c6",
    description: "Nice to have: no deadline",
    name: PRIORITY_LABELS.low,
  },
  {
    color: "8a63d2",
    description:
      "A main flow breaks for many users, or data or credentials are at risk",
    name: "impact: high",
  },
  {
    color: "b392f0",
    description: "A feature degrades for some users, a workaround exists",
    name: "impact: medium",
  },
  {
    color: "e1d4fb",
    description: "Cosmetic, or few users affected",
    name: "impact: low",
  },
  {
    color: "7057ff",
    description: "Fully specified, small and well scoped, good for newcomers",
    name: GOOD_FIRST_ISSUE_LABEL,
  },
  {
    color: "008672",
    description: "Fully specified and open to outside contributors",
    name: HELP_WANTED_LABEL,
  },
];
