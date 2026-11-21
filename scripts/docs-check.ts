#!/usr/bin/env bun
import { existsSync } from "node:fs";
import path from "node:path";

import { Glob } from "bun";
import { Result } from "effect";
import { z } from "zod";

import { headingSlug } from "./docs-markdown";

interface Page {
  file: string;
  frontmatter: string | undefined;
  body: string[];
}

interface Link {
  line: number;
  target: string;
}

interface Fence {
  line: number;
  language: string;
}

interface Scan {
  prose: (string | undefined)[];
  fences: Fence[];
}

const frontmatterParser = z.strictObject({
  description: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

const metaParser = z.object({ pages: z.array(z.string()) });

type MetaFile = z.infer<typeof metaParser>;

const DOCS_ROOT = "docs";
const LLMS_FILE = "docs/llms.txt";
const META_FILE = "meta.json";
const PAGE_EXTENSION = ".md";
const DRAFT_MARKER = "TODO: draft in progress";
const UNVERIFIED_MARKER = "TODO (unverified)";
const FRONTMATTER_DELIMITER = "---";
const SUCCESS = 0;
const FAILURE = 1;

const FENCE_LANGUAGES = new Set([
  "bash",
  "sh",
  "dotenv",
  "yaml",
  "json",
  "text",
  "ts",
  "tsx",
  "ini",
  "diff",
  "sql",
  "nginx",
]);

const FENCE = /^ {0,3}(?<marker>`{3,}|~{3,})(?<info>.*)$/u;

const ATX_HEADING =
  /^ {0,3}(?<level>#{1,6})(?:[ \t]+(?<text>.*?))?(?:[ \t]+#+)?[ \t]*$/u;

const INLINE_CODE = /(?<ticks>`+)[\s\S]*?\k<ticks>/gu;

const INLINE_LINK =
  /!?\[(?:[^\]\\]|\\.)*\]\(\s*(?<target><[^>]*>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/gu;

const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(?<target><[^>]*>|\S+)/u;
const WHITESPACE = /\s/u;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;
const VERSIONED_DOCS_LINK = /\/docs\/(?:next\/|\d+\.)/u;
const META_SEPARATOR = /^---.+---$/u;

const IMAGE =
  /!\[(?<alt>(?:[^\]\\]|\\.)*)\]\(\s*(?<target><[^>]*>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/gu;

const IMAGES_DIR = `${DOCS_ROOT}/images`;
const IMAGE_EXTENSIONS = "png,jpg,jpeg,webp,gif,svg";
const LLMS_H1 = /^# \S/u;
const LLMS_H2 = /^## \S/u;
const LLMS_SUMMARY = /^> \S/u;
const LLMS_ITEM = /^- \[[^\]]+\]\((?<target>[^)\s]+)\)(?:: \S.*)?$/u;

const failures: string[] = [];

const fail = (where: string, message: string): void => {
  failures.push(`${where}: ${message}`);
};

const parseWith = <T>(
  parse: () => T,
  describe: (error: z.ZodError) => string
): Result.Result<T, string> =>
  Result.try({
    catch: (error) =>
      error instanceof z.ZodError ? describe(error) : String(error),
    try: parse,
  });

const zodProblems = (error: z.ZodError): string =>
  z.prettifyError(error).replaceAll("\n", " ");

const parseFrontmatter = (
  text: string
): Result.Result<z.infer<typeof frontmatterParser>, string> =>
  parseWith(() => frontmatterParser.parse(Bun.YAML.parse(text)), zodProblems);

const parseMeta = (text: string): Result.Result<MetaFile, string> =>
  parseWith(() => metaParser.parse(JSON.parse(text)), zodProblems);

const splitPage = (file: string, text: string): Page => {
  const lines = text.split("\n");
  const end =
    lines[0] === FRONTMATTER_DELIMITER
      ? lines.indexOf(FRONTMATTER_DELIMITER, 1)
      : -1;

  if (end === -1) {
    return { body: lines, file, frontmatter: undefined };
  }

  return {
    body: lines.slice(end + 1),
    file,
    frontmatter: lines.slice(1, end).join("\n"),
  };
};

const scan = (lines: string[]): Scan => {
  const prose: (string | undefined)[] = [];
  const fences: Fence[] = [];
  let open: string | undefined;

  for (const [index, line] of lines.entries()) {
    const fence = FENCE.exec(line);
    const marker = fence?.groups?.marker;
    const infoString = (fence?.groups?.info ?? "").trim();

    if (open === undefined && marker !== undefined) {
      open = marker;
      fences.push({
        language: infoString.split(WHITESPACE)[0] ?? "",
        line: index,
      });
    } else if (
      open !== undefined &&
      marker !== undefined &&
      marker[0] === open[0] &&
      marker.length >= open.length &&
      infoString === ""
    ) {
      open = undefined;
    }

    prose.push(open === undefined && marker === undefined ? line : undefined);
  }

  return { fences, prose };
};

const headingsOf = (lines: string[]): { level: number; text: string }[] =>
  scan(lines).prose.flatMap((line) => {
    const match = line === undefined ? null : ATX_HEADING.exec(line);
    const level = match?.groups?.level;

    return level === undefined
      ? []
      : [{ level: level.length, text: match?.groups?.text ?? "" }];
  });

const slugsOf = (lines: string[]): Set<string> => {
  const seen = new Map<string, number>();
  const slugs = new Set<string>();

  for (const { text } of headingsOf(lines)) {
    const base = headingSlug(text);
    const count = seen.get(base) ?? 0;

    slugs.add(count === 0 ? base : `${base}-${count}`);
    seen.set(base, count + 1);
  }

  return slugs;
};

const linksOf = (lines: string[]): Link[] =>
  scan(lines).prose.flatMap((line, index): Link[] => {
    if (line === undefined) {
      return [];
    }

    const prose = line.replace(INLINE_CODE, (span) => " ".repeat(span.length));
    const inline = [...prose.matchAll(INLINE_LINK)].map(
      (match) => match.groups?.target ?? ""
    );

    const reference = REFERENCE_DEFINITION.exec(prose)?.groups?.target;

    return [...inline, ...(reference === undefined ? [] : [reference])].map(
      (target) => ({
        line: index,
        target: target.startsWith("<") ? target.slice(1, -1) : target,
      })
    );
  });

const checkFrontmatter = (page: Page): void => {
  if (page.frontmatter === undefined) {
    fail(
      page.file,
      "no frontmatter; open the page with title and description."
    );

    return;
  }

  const parsed = parseFrontmatter(page.frontmatter);

  if (Result.isFailure(parsed)) {
    fail(
      page.file,
      `the frontmatter must hold exactly a non-empty title and description: ${parsed.failure}`
    );
  }
};

const checkBody = (page: Page, offset: number): void => {
  for (const heading of headingsOf(page.body)) {
    if (heading.level === 1) {
      fail(
        page.file,
        `H1 "${heading.text}" in the body; the title comes from the frontmatter, so start sections at H2.`
      );
    }
  }

  for (const [index, line] of page.body.entries()) {
    if (line.includes(DRAFT_MARKER)) {
      fail(
        `${page.file}:${index + offset}`,
        `"${DRAFT_MARKER}": the page is a stub.`
      );
    }
  }

  for (const { language, line } of scan(page.body).fences) {
    if (!FENCE_LANGUAGES.has(language)) {
      fail(
        `${page.file}:${line + offset}`,
        `code fence language "${language}" is not one of ${[...FENCE_LANGUAGES].join(", ")}.`
      );
    }
  }
};

const resolveLink = (
  from: string,
  target: string,
  pages: Map<string, Page>
): string | undefined => {
  const [pathPart = "", anchor] = target.split("#", 2);
  const linkedPath = decodeURIComponent(pathPart.split("?")[0] ?? "");
  const resolved =
    linkedPath === ""
      ? from
      : path
          .normalize(path.join(path.dirname(from), linkedPath))
          .replaceAll("\\", "/");

  if (linkedPath !== "" && !(pages.has(resolved) || existsSync(resolved))) {
    return `the target ${resolved} does not exist.`;
  }

  if (anchor === undefined || anchor === "") {
    return undefined;
  }

  const targetPage = pages.get(resolved);

  if (targetPage === undefined) {
    return `the anchor #${anchor} points into ${resolved}, which is not a docs page.`;
  }

  return slugsOf(targetPage.body).has(anchor)
    ? undefined
    : `no heading in ${resolved} has the slug #${anchor}.`;
};

const checkLinks = (
  page: Page,
  offset: number,
  pages: Map<string, Page>
): void => {
  for (const { line, target } of linksOf(page.body)) {
    const where = `${page.file}:${line + offset}`;

    if (VERSIONED_DOCS_LINK.test(target)) {
      fail(
        where,
        `the link ${target} names a docs version; link the .md file relatively.`
      );
    }

    if (!(URL_SCHEME.test(target) || target.startsWith("/"))) {
      const problem = resolveLink(page.file, target, pages);

      if (problem !== undefined) {
        fail(where, `link ${target}: ${problem}`);
      }
    }
  }
};

const imagesOf = (
  page: Page
): { alt: string; line: number; target: string }[] =>
  scan(page.body).prose.flatMap((line, index) =>
    line === undefined
      ? []
      : [
          ...line
            .replace(INLINE_CODE, (span) => " ".repeat(span.length))
            .matchAll(IMAGE),
        ].map((match) => ({
          alt: match.groups?.alt?.trim() ?? "",
          line: index,
          target: match.groups?.target ?? "",
        }))
  );

const checkImages = (page: Page, offset: number, used: Set<string>): void => {
  for (const { alt, line, target } of imagesOf(page)) {
    const where = `${page.file}:${line + offset}`;

    if (alt === "") {
      fail(where, `image ${target} has no alt text; describe what it shows.`);
    }

    if (URL_SCHEME.test(target) || target.startsWith("/")) {
      fail(
        where,
        `image ${target} is not a relative path; put the file in ${IMAGES_DIR}.`
      );

      continue;
    }

    const resolved = path
      .normalize(path.join(path.dirname(page.file), target))
      .replaceAll("\\", "/");

    used.add(resolved);

    if (!resolved.startsWith(`${IMAGES_DIR}/`)) {
      fail(where, `image ${target} lives outside ${IMAGES_DIR}.`);
    }
  }
};

const checkUnusedImages = (used: Set<string>): void => {
  for (const file of new Glob(
    `${IMAGES_DIR}/**/*.{${IMAGE_EXTENSIONS}}`
  ).scanSync(".")) {
    const normalised = file.replaceAll("\\", "/");

    if (!used.has(normalised)) {
      fail(normalised, "no page shows this image; link it or delete it.");
    }
  }
};

const childrenOf = (
  folder: string,
  pageFiles: Set<string>,
  folders: Set<string>
): string[] => [
  ...[...pageFiles].flatMap((file) =>
    path.dirname(file) === folder ? [path.basename(file, PAGE_EXTENSION)] : []
  ),
  ...[...folders].flatMap((child) =>
    child !== folder && path.dirname(child) === folder
      ? [path.basename(child)]
      : []
  ),
];

const checkMeta = async (
  folder: string,
  pageFiles: Set<string>,
  folders: Set<string>
): Promise<void> => {
  const metaFile = path.join(folder, META_FILE);
  const metaHandle = Bun.file(metaFile);

  if (!(await metaHandle.exists())) {
    fail(folder, `no ${META_FILE}; list the folder's pages in one.`);

    return;
  }

  const parsed = parseMeta(await metaHandle.text());

  if (Result.isFailure(parsed)) {
    fail(metaFile, `not JSON with a pages array of strings: ${parsed.failure}`);

    return;
  }

  const listed = new Map<string, number>();

  for (const entry of parsed.success.pages) {
    if (!META_SEPARATOR.test(entry)) {
      const isPage = pageFiles.has(
        path.join(folder, `${entry}${PAGE_EXTENSION}`)
      );

      if (!(isPage || folders.has(path.join(folder, entry)))) {
        fail(
          metaFile,
          `the entry "${entry}" is neither a page nor a subfolder.`
        );
      }

      listed.set(entry, (listed.get(entry) ?? 0) + 1);
    }
  }

  for (const child of childrenOf(folder, pageFiles, folders)) {
    const count = listed.get(child) ?? 0;

    if (count !== 1) {
      fail(
        metaFile,
        `"${child}" is listed ${count} times; list it exactly once.`
      );
    }
  }
};

const checkLlmsItems = (
  lines: string[],
  firstSection: number,
  pages: Map<string, Page>
): void => {
  for (const [index, line] of lines.entries()) {
    const isItemLine =
      index > firstSection && line.trim() !== "" && !LLMS_H2.test(line);

    const target = LLMS_ITEM.exec(line)?.groups?.target;
    const where = `${LLMS_FILE}:${index + 1}`;

    if (isItemLine && target === undefined) {
      fail(where, `expected "- [Title](relative.md): note", got "${line}".`);
    }

    const problem =
      isItemLine && target !== undefined && !URL_SCHEME.test(target)
        ? resolveLink(LLMS_FILE, target, pages)
        : undefined;

    if (problem !== undefined) {
      fail(where, `link ${target}: ${problem}`);
    }
  }
};

const checkLlms = async (pages: Map<string, Page>): Promise<void> => {
  const llmsHandle = Bun.file(LLMS_FILE);

  if (!(await llmsHandle.exists())) {
    fail(LLMS_FILE, "missing.");

    return;
  }

  const llmsText = await llmsHandle.text();
  const lines = llmsText.split("\n");
  const firstLine = lines.find((line) => line.trim() !== "") ?? "";
  const firstSection = lines.findIndex((line) => LLMS_H2.test(line));
  const preamble = firstSection === -1 ? lines : lines.slice(0, firstSection);

  if (!LLMS_H1.test(firstLine)) {
    fail(LLMS_FILE, "the first line must be an H1 with the project name.");
  }

  if (!preamble.some((line) => LLMS_SUMMARY.test(line))) {
    fail(LLMS_FILE, `a "> " summary must sit between the H1 and the first H2.`);
  }

  if (firstSection === -1) {
    fail(LLMS_FILE, "no H2 section.");

    return;
  }

  checkLlmsItems(lines, firstSection, pages);
};

const runReferenceCheck = async (): Promise<number> => {
  const child = Bun.spawn(["bun", "scripts/docs-reference.ts", "--check"], {
    stderr: "inherit",
    stdout: "inherit",
  });

  return await child.exited;
};

const reportUnverified = (files: string[], texts: string[]): void => {
  for (const [index, file] of files.entries()) {
    const count = (texts[index] ?? "").split(UNVERIFIED_MARKER).length - 1;

    if (count > 0) {
      process.stdout.write(
        `docs-check: info: ${file} has ${count} "${UNVERIFIED_MARKER}" markers\n`
      );
    }
  }
};

const main = async (): Promise<number> => {
  const files = [
    ...new Glob(`${DOCS_ROOT}/**/*${PAGE_EXTENSION}`).scanSync("."),
  ]
    .map((file) => file.replaceAll("\\", "/"))
    .toSorted();

  const texts = await Promise.all(files.map((file) => Bun.file(file).text()));
  const pages = new Map(
    files.map((file, index) => [file, splitPage(file, texts[index] ?? "")])
  );

  const pageFiles = new Set(files);
  const folders = new Set(
    files.flatMap((file) => {
      const parts = path.dirname(file).split("/");

      return parts.map((_part, index) => parts.slice(0, index + 1).join("/"));
    })
  );

  const usedImages = new Set<string>();

  for (const page of pages.values()) {
    const offset =
      page.frontmatter === undefined
        ? 1
        : page.frontmatter.split("\n").length + 3;

    checkFrontmatter(page);
    checkBody(page, offset);
    checkLinks(page, offset, pages);
    checkImages(page, offset, usedImages);
  }

  checkUnusedImages(usedImages);

  await Promise.all(
    [...folders].map((folder) => checkMeta(folder, pageFiles, folders))
  );

  await checkLlms(pages);
  reportUnverified(files, texts);

  for (const message of failures) {
    process.stderr.write(`docs-check: ${message}\n`);
  }

  const referenceStatus = await runReferenceCheck();

  if (failures.length > 0 || referenceStatus !== SUCCESS) {
    process.stderr.write(
      `docs-check: ${failures.length} problems in ${pages.size} pages${referenceStatus === SUCCESS ? "" : ", and docs-reference --check failed"}\n`
    );

    return FAILURE;
  }

  process.stdout.write(`docs-check: ${pages.size} pages, no problems\n`);

  return SUCCESS;
};

process.exitCode = await main();
