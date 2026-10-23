const URL_SCHEME = /^https?:\/\//iu;

export type FieldProblem = "domain-has-scheme";

const FIELD_RULES: Readonly<
  Record<string, (value: string) => FieldProblem | null>
> = {
  POWENS_DOMAIN: (value) =>
    URL_SCHEME.test(value.trim()) ? "domain-has-scheme" : null,
};

export const fieldProblem = (key: string, value: string): FieldProblem | null =>
  FIELD_RULES[key]?.(value) ?? null;
