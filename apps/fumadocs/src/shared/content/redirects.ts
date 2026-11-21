import { MOVED_PAGES } from "../config/moved-pages";
import { docsRoute } from "../config/site";
import { encodeMarkdownUrl } from "../lib/markdown-url";
import { type DocsPage, markdownUrlOf, pageAtFile, source } from "./source";

const RELEASE_VERSION = /^\d+\.\d+$/;

const NEXT_VERSION = "next";

const MARKDOWN_EXTENSION = /\.md$/;

const isOldVersion = (segment: string | undefined) =>
  segment === NEXT_VERSION ||
  (segment !== undefined && RELEASE_VERSION.test(segment));

export const movedPageOf = (path: string): DocsPage | undefined => {
  const moved = MOVED_PAGES[path];

  return moved === undefined ? undefined : pageAtFile(`${moved}.md`);
};

const currentPageOf = (path: string): DocsPage | undefined =>
  source.getPage(path.split("/").filter(Boolean)) ?? movedPageOf(path);

export const versionedRedirectOf = (pathname: string): string | undefined => {
  if (!pathname.startsWith(`${docsRoute}/`)) return undefined;

  const rest = pathname.slice(docsRoute.length + 1);
  const markdown = MARKDOWN_EXTENSION.test(rest);
  const [version, ...segments] = rest
    .replace(MARKDOWN_EXTENSION, "")
    .split("/");

  if (!isOldVersion(version)) return undefined;

  const page = currentPageOf(segments.join("/"));

  if (markdown) return page ? markdownUrlOf(page) : encodeMarkdownUrl([]);

  return page?.url ?? docsRoute;
};
