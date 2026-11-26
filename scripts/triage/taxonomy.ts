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

export const LEVELS = ["Low", "Medium", "High"] as const;

export type Level = (typeof LEVELS)[number];

export const isLevel = (value: string | undefined): value is Level =>
  LEVELS.some((level) => level === value);

export const ISSUE_FIELDS = {
  impact: "Impact",
  priority: "Priority",
} as const;

export type FieldKey = keyof typeof ISSUE_FIELDS;

export const FIELD_KEYS: readonly FieldKey[] = ["impact", "priority"];

export type FieldValues = Partial<Record<FieldKey, Level>>;

export const fieldValuesOf = (
  values: readonly {
    readonly name: string | undefined;
    readonly value: string | undefined;
  }[]
): FieldValues => {
  const levels: FieldValues = {};

  for (const key of FIELD_KEYS) {
    const value = values.find(
      (entry) => entry.name === ISSUE_FIELDS[key]
    )?.value;

    if (isLevel(value)) {
      levels[key] = value;
    }
  }

  return levels;
};

export const GOOD_FIRST_ISSUE_LABEL = "good first issue";
export const HELP_WANTED_LABEL = "help wanted";

export const LABELS: readonly LabelDefinition[] = [
  {
    color: "0075ca",
    description: "A Task issue about the documentation site, README or guides",
    name: DOCUMENTATION_LABEL,
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
