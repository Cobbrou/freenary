import { redirect } from "@tanstack/react-router";
import {
  createMiddleware,
  createCsrfMiddleware,
  createStart,
} from "@tanstack/react-start";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";

import { docsRoute } from "@/shared/config";
import { newestRelease } from "@/shared/content";
import { encodeMarkdownUrl } from "@/shared/lib/markdown-url";
import { isVersionId } from "@/shared/lib/versions";

const LEADING_SLASH = /^\//;

const MARKDOWN_EXTENSION = /\.md$/;

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const unversionedDocsRedirect = createMiddleware().server(
  ({ next, request }) => {
    const url = new URL(request.url);
    const insideDocs =
      url.pathname === docsRoute || url.pathname.startsWith(`${docsRoute}/`);

    if (!insideDocs) {
      return next();
    }

    const rest = url.pathname
      .slice(docsRoute.length)
      .replace(LEADING_SLASH, "");

    const [firstSegment] = rest.split("/");

    if (isVersionId(firstSegment.replace(MARKDOWN_EXTENSION, ""))) {
      return next();
    }

    url.pathname = [docsRoute, newestRelease(), rest].filter(Boolean).join("/");

    throw redirect({ href: url.href });
  }
);

const markdownRepresentationRedirect = createMiddleware().server(
  ({ next, request }) => {
    const url = new URL(request.url);

    if (
      url.pathname.startsWith(docsRoute) &&
      !url.pathname.endsWith(".md") &&
      isMarkdownPreferred(request)
    ) {
      const slugs = url.pathname
        .slice(docsRoute.length)
        .split("/")
        .filter((v) => v.length > 0);

      url.pathname = encodeMarkdownUrl(slugs);

      throw redirect({ href: url.href, headers: { Vary: "Accept" } });
    }

    return next();
  }
);

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [
      csrfMiddleware,
      unversionedDocsRedirect,
      markdownRepresentationRedirect,
    ],
  };
});
