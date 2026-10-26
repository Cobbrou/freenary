export interface LabelDefinition {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

export const TYPE_LABELS = {
  bug: "type: bug",
  documentation: "type: documentation",
  feature: "type: feature",
  maintenance: "type: maintenance",
} as const;

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
  type: "type:",
} as const;

export const LABELS: readonly LabelDefinition[] = [
  {
    color: "d73a4a",
    description: "Something in Freenary behaves incorrectly",
    name: TYPE_LABELS.bug,
  },
  {
    color: "0e8a16",
    description: "A new capability, or an improvement to an existing one",
    name: TYPE_LABELS.feature,
  },
  {
    color: "0075ca",
    description: "Documentation site, README or contributor guides",
    name: TYPE_LABELS.documentation,
  },
  {
    color: "fef2c0",
    description: "Dependencies, refactoring, tooling, tests or chores",
    name: TYPE_LABELS.maintenance,
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
