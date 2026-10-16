const ALLOWED_FRONTMATTER_KEYS = {
  description: true,
  full: true,
  icon: true,
  title: true,
} satisfies Record<string, true>;

const ALLOWED_SHIKI_LANGUAGES = {
  bash: true,
  diff: true,
  dockerfile: true,
  dotenv: true,
  http: true,
  json: true,
  jsonc: true,
  md: true,
  mdx: true,
  prisma: true,
  sql: true,
  text: true,
  ts: true,
  tsx: true,
  yaml: true,
} satisfies Record<string, true>;

const OPERATOR_ONLY_CODE_LANGUAGES = {
  bash: true,
  diff: true,
  dockerfile: true,
  dotenv: true,
  http: true,
  json: true,
  jsonc: true,
  prisma: true,
  sql: true,
  ts: true,
  tsx: true,
  yaml: true,
} satisfies Record<string, true>;

export const isAllowedFrontmatterKey = (key: string): boolean =>
  Object.hasOwn(ALLOWED_FRONTMATTER_KEYS, key);

export const isAllowedCodeLanguage = (language: string): boolean =>
  Object.hasOwn(ALLOWED_SHIKI_LANGUAGES, language);

export const isOperatorOnlyCodeLanguage = (language: string): boolean =>
  Object.hasOwn(OPERATOR_ONLY_CODE_LANGUAGES, language);

export const ROADMAP_PHRASES: readonly RegExp[] = [
  /\bcoming soon\b/gi,
  /\broadmap\b/gi,
  /\bnot yet (?:built|implemented|available|supported)\b/gi,
  /\bin a (?:future|later) (?:release|version)\b/gi,
  /\bwe plan to\b/gi,
  /\bis planned\b/gi,
  /\bwill be (?:added|supported|available)\b/gi,
];

export const ENV_VAR_OR_ENUM_NAME = /\b[A-Z][A-Z\d]*(?:_[A-Z\d]+)+\b/g;

export const LONG_SENTENCE_WORD_LIMIT = 35;
