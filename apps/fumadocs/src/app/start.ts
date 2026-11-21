import { redirect } from "@tanstack/react-router";
import {
  createMiddleware,
  createCsrfMiddleware,
  createStart,
} from "@tanstack/react-start";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";

import { docsRoute } from "@/shared/config";
import { markdownUrlOf, source, versionedRedirectOf } from "@/shared/content";
import { encodeMarkdownUrl } from "@/shared/lib/markdown-url";

const FILE_EXTENSION = /\.[a-z]+$/i;

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const isInsideDocs = (pathname: string) =>
  pathname === docsRoute || pathname.startsWith(`${docsRoute}/`);

const versionedDocsRedirect = createMiddleware().server(({ next, request }) => {
  const url = new URL(request.url);
  const target = versionedRedirectOf(url.pathname);

  if (target === undefined) {
    return next();
  }

  url.pathname = target;

  throw redirect({ href: url.href });
});

const markdownRepresentationRedirect = createMiddleware().server(
  ({ next, request }) => {
    const url = new URL(request.url);

    if (
      isInsideDocs(url.pathname) &&
      !FILE_EXTENSION.test(url.pathname) &&
      isMarkdownPreferred(request)
    ) {
      const slugs = url.pathname
        .slice(docsRoute.length)
        .split("/")
        .filter((segment) => segment.length > 0);

      const page = source.getPage(slugs);

      url.pathname = page ? markdownUrlOf(page) : encodeMarkdownUrl(slugs);

      throw redirect({ href: url.href, headers: { Vary: "Accept" } });
    }

    return next();
  }
);

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [
      csrfMiddleware,
      versionedDocsRedirect,
      markdownRepresentationRedirect,
    ],
  };
});
