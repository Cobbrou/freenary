import { docsRoute } from "../config/site";
import { type DocsPage, markdownUrlOf, pageAtFile, source } from "./source";

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

const MARKDOWN_FILE = /\.md$/;

const PARENT_SEGMENT = "..";

const CURRENT_SEGMENT = ".";

type LinkTarget = {
  page: DocsPage;
  hash: string | undefined;
};

const isRelative = (href: string) =>
  !(URL_SCHEME.test(href) || href.startsWith("/") || href.startsWith("#"));

const joinRelative = (fromFile: string, relative: string) => {
  const segments = fromFile.split("/").slice(0, -1);

  for (const segment of relative.split("/")) {
    if (segment === PARENT_SEGMENT) {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else if (segment !== CURRENT_SEGMENT && segment !== "") {
      segments.push(segment);
    }
  }

  return segments.join("/");
};

const relativeTarget = (
  href: string,
  fromFile: string
): LinkTarget | undefined => {
  if (!isRelative(href)) return undefined;

  const [file = "", hash] = href.split("#", 2);

  if (!MARKDOWN_FILE.test(file)) return undefined;

  const path = joinRelative(fromFile, file);
  const page = path === undefined ? undefined : pageAtFile(path);

  return page ? { page, hash } : undefined;
};

const withHash = (url: string, hash: string | undefined) =>
  hash === undefined ? url : `${url}#${hash}`;

export const pageUrlOfLink = (href: string, fromFile: string): string => {
  const target = relativeTarget(href, fromFile);

  return target ? withHash(target.page.url, target.hash) : href;
};

export const markdownUrlOfLink = (href: string, fromFile: string): string => {
  const target = relativeTarget(href, fromFile);

  return target ? withHash(markdownUrlOf(target.page), target.hash) : href;
};

export const pageUrlOfLinkAt = (href: string, pathname: string): string => {
  const slugs = pathname
    .slice(docsRoute.length)
    .split("/")
    .filter((segment) => segment.length > 0);

  const page = source.getPage(slugs);

  return page ? pageUrlOfLink(href, page.path) : href;
};
