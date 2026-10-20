import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Glob } from "bun";
import { z } from "zod";

export type CodeFence = {
  readonly language: string;
  readonly index: number;
};

export type DocLink = {
  readonly target: string;
  readonly index: number;
};

export type DocHeading = {
  readonly text: string;
  readonly index: number;
};

export type ComponentUse = {
  readonly name: string;
  readonly index: number;
};

export type DocPage = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly url: string;
  readonly raw: string;
  readonly frontmatter: ReadonlyMap<string, string>;
  readonly frontmatterLineByKey: ReadonlyMap<string, number>;
  readonly anchorIds: ReadonlySet<string>;
  readonly headings: readonly DocHeading[];
  readonly fences: readonly CodeFence[];
  readonly components: readonly ComponentUse[];
  readonly links: readonly DocLink[];
  readonly maskedProse: string;
};

export type MetaFile = {
  readonly absolutePath: string;
  readonly folder: string;
  readonly pages: readonly string[];
  readonly root: boolean | undefined;
  readonly title: string | undefined;
};

type Frontmatter = {
  readonly fields: ReadonlyMap<string, string>;
  readonly lineByKey: ReadonlyMap<string, number>;
};

type PageHeadings = {
  readonly headings: readonly DocHeading[];
  readonly anchorIds: ReadonlySet<string>;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const FRONTMATTER_LINE = /^([A-Za-z][\w-]*):\s*(.*)$/;
const FRONTMATTER_QUOTES = /^["']|["']$/g;
const FIRST_FRONTMATTER_LINE = 2;
const CODE_FENCE = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n[\s\S]*?^\1\2[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]+`/g;
const JSX_TAG = /<\/?[A-Za-z][\w.]*(?:\s[^>]*?)?\/?>/g;
const JSX_EXPRESSION = /\{\{[\s\S]*?\}\}/g;
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
const EXPLICIT_HEADING_ID = /\s*(?:\[#([\w-]+)\]|\{#([\w-]+)\})\s*$/;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
const HREF_ATTRIBUTE = /href=(?:"([^"]*)"|\{`([^`]*)`\})/g;
const HEADING_MARKUP = /`|\*\*|__|\[([^\]]*)\]\([^)]*\)/g;
const NON_SLUG = /[^\da-z\s-]/g;
const SLUG_SPACE = /\s+/g;
const OPENING_TAG_NAME = /^<([A-Z][\w.]*)/;
const PAGE_EXTENSION = /\.mdx$/;
const INDEX_PAGE = /(^|\/)index$/;
const EVERYTHING_BUT_NEWLINES = /[^\n]/g;
const FENCE_INFO_SPLIT = /\s+/;

const metaJsonSchema = z
  .object({
    pages: z.array(z.string()).catch([]),
    root: z.boolean().optional().catch(undefined),
    title: z.string().optional().catch(undefined),
  })
  .catch({ pages: [], root: undefined, title: undefined });

export const lineAt = (text: string, index: number): number => {
  let line = 1;

  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
    }
  }

  return line;
};

const blankKeepingNewlines = (text: string): string =>
  text.replace(EVERYTHING_BUT_NEWLINES, " ");

const maskPattern = (text: string, pattern: RegExp): string => {
  pattern.lastIndex = 0;

  return text.replace(pattern, blankKeepingNewlines);
};

const maskAsCapitalisedWord = (text: string): string =>
  text.replace(EVERYTHING_BUT_NEWLINES, "X");

export const slugify = (heading: string): string =>
  heading
    .replace(
      HEADING_MARKUP,
      (_match, linkText: string | undefined) => linkText ?? ""
    )
    .trim()
    .toLowerCase()
    .replace(NON_SLUG, "")
    .replace(SLUG_SPACE, "-");

const parseFrontmatter = (raw: string): Frontmatter => {
  const fields = new Map<string, string>();
  const lineByKey = new Map<string, number>();
  const block = FRONTMATTER.exec(raw);

  if (!block) {
    return { fields, lineByKey };
  }

  for (const [offset, line] of block[1].split("\n").entries()) {
    const entry = FRONTMATTER_LINE.exec(line);

    if (!entry) {
      continue;
    }

    fields.set(entry[1], entry[2].trim().replace(FRONTMATTER_QUOTES, ""));
    lineByKey.set(entry[1], offset + FIRST_FRONTMATTER_LINE);
  }

  return { fields, lineByKey };
};

const collectHeadings = (raw: string): PageHeadings => {
  const headings: DocHeading[] = [];
  const anchorIds = new Set<string>();
  HEADING.lastIndex = 0;
  let match = HEADING.exec(raw);

  while (match) {
    const explicit = EXPLICIT_HEADING_ID.exec(match[2]);
    const text = explicit
      ? match[2].slice(0, explicit.index).trim()
      : match[2].trim();

    headings.push({ index: match.index, text });
    anchorIds.add(explicit ? (explicit[1] ?? explicit[2]) : slugify(text));
    match = HEADING.exec(raw);
  }

  return { anchorIds, headings };
};

const collectMatches = (
  raw: string,
  pattern: RegExp,
  pick: (match: RegExpExecArray) => string | undefined
) => {
  const found: Array<{ value: string; index: number }> = [];
  pattern.lastIndex = 0;
  let match = pattern.exec(raw);

  while (match) {
    const value = pick(match);

    if (value !== undefined) {
      found.push({ index: match.index, value });
    }

    match = pattern.exec(raw);
  }

  return found;
};

const collectFences = (raw: string): CodeFence[] =>
  collectMatches(
    raw,
    CODE_FENCE,
    (match) => match[3].trim().split(FENCE_INFO_SPLIT)[0]
  ).map(({ value, index }) => ({ index, language: value }));

const maskCodeSpans = (raw: string): string =>
  maskPattern(maskPattern(raw, CODE_FENCE), INLINE_CODE);

const collectOpeningComponentTags = (raw: string): ComponentUse[] =>
  collectMatches(
    maskCodeSpans(raw),
    JSX_TAG,
    (match) => OPENING_TAG_NAME.exec(match[0])?.[1]
  ).map(({ value, index }) => ({ index, name: value }));

const collectLinks = (raw: string): DocLink[] => {
  const masked = maskCodeSpans(raw);
  const markdown = collectMatches(masked, MARKDOWN_LINK, (match) => match[1]);
  const attributes = collectMatches(
    masked,
    HREF_ATTRIBUTE,
    (match) => match[1] ?? match[2]
  );

  return [...markdown, ...attributes].map(({ value, index }) => ({
    index,
    target: value,
  }));
};

const maskNonProse = (raw: string): string => {
  const withoutFrontmatter = raw.replace(FRONTMATTER, blankKeepingNewlines);
  const withoutCode = maskPattern(withoutFrontmatter, CODE_FENCE);
  INLINE_CODE.lastIndex = 0;
  const withInlineCodeAsWords = withoutCode.replace(
    INLINE_CODE,
    maskAsCapitalisedWord
  );

  const withoutExpressions = maskPattern(withInlineCodeAsWords, JSX_EXPRESSION);

  return maskPattern(withoutExpressions, JSX_TAG);
};

const urlFor = (relativePath: string, baseRoute: string): string => {
  const slug = relativePath.replace(PAGE_EXTENSION, "").replace(INDEX_PAGE, "");

  return slug === "" ? baseRoute : `${baseRoute}/${slug}`;
};

const scanSorted = async (contentDir: string, pattern: string) => {
  const found: string[] = [];

  for await (const match of new Glob(pattern).scan({ cwd: contentDir })) {
    found.push(match);
  }

  found.sort();

  return found;
};

export const readPages = async (
  contentDir: string,
  baseRoute: string
): Promise<DocPage[]> => {
  const pages: DocPage[] = [];

  for (const relativePath of await scanSorted(contentDir, "**/*.mdx")) {
    const absolutePath = join(contentDir, relativePath);
    const raw = await readFile(absolutePath, "utf8");
    const { fields, lineByKey } = parseFrontmatter(raw);
    const { headings, anchorIds } = collectHeadings(
      maskPattern(raw, CODE_FENCE)
    );

    pages.push({
      absolutePath,
      anchorIds,
      components: collectOpeningComponentTags(raw),
      fences: collectFences(raw),
      frontmatter: fields,
      frontmatterLineByKey: lineByKey,
      headings,
      links: collectLinks(raw),
      maskedProse: maskNonProse(raw),
      raw,
      relativePath,
      url: urlFor(relativePath, baseRoute),
    });
  }

  return pages;
};

export const readMetaFiles = async (
  contentDir: string
): Promise<MetaFile[]> => {
  const metas: MetaFile[] = [];

  for (const relativePath of await scanSorted(contentDir, "**/meta.json")) {
    const absolutePath = join(contentDir, relativePath);
    const lastSlash = relativePath.lastIndexOf("/");
    const { pages, root, title } = metaJsonSchema.parse(
      JSON.parse(await readFile(absolutePath, "utf8"))
    );

    metas.push({
      absolutePath,
      folder: lastSlash === -1 ? "" : relativePath.slice(0, lastSlash),
      pages,
      root,
      title,
    });
  }

  return metas;
};
