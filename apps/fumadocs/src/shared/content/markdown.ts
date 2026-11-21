import { remark } from "remark";
import { visit } from "unist-util-visit";

import { docsRawUrl } from "../config/site";
import { withoutHeadingIds } from "../lib/heading-ids";
import {
  imageTargetsOf,
  resolveRelativePath,
  withMarkdownImages,
} from "../lib/markdown-images";
import { markdownUrlOfLink } from "./links";
import type { DocsPage } from "./source";

type Replacement = { start: number; end: number; url: string };

const markdownParser = remark();

const DOCS_SOURCE_PREFIX = "../../../../../docs/";

const docsSources = import.meta.glob<string>("../../../../../docs/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

const imageTargetsOfPage = (pagePath: string): string[] =>
  imageTargetsOf(docsSources[`${DOCS_SOURCE_PREFIX}${pagePath}`] ?? "");

export const withAbsoluteMarkdownLinks = (
  markdown: string,
  fromFile: string
): string => {
  const replacements: Replacement[] = [];

  visit(markdownParser.parse(markdown), (node) => {
    if (node.type !== "link" && node.type !== "definition") return;

    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    const url = markdownUrlOfLink(node.url, fromFile);

    if (start === undefined || end === undefined || url === node.url) return;

    const urlStart = markdown.lastIndexOf(node.url, end - node.url.length);

    if (urlStart < start) return;

    replacements.push({
      start: urlStart,
      end: urlStart + node.url.length,
      url,
    });
  });

  return replacements.reduceRight(
    (text, { start, end, url }) =>
      `${text.slice(0, start)}${url}${text.slice(end)}`,
    markdown
  );
};

export const getLLMText = async (page: DocsPage): Promise<string> => {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

> ${page.data.description}

${withAbsoluteMarkdownLinks(
  withMarkdownImages(
    withoutHeadingIds(processed),
    imageTargetsOfPage(page.path),
    (target) => docsRawUrl(resolveRelativePath(page.path, target))
  ),
  page.path
).trim()}
`;
};
