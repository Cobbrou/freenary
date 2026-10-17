import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { SerializedPageTree } from "fumadocs-core/source/client";

import { docsRoute } from "@/shared/config";
import { findMovedPage, newestRelease, source } from "@/shared/content";
import { encodeMarkdownUrl } from "@/shared/lib/markdown-url";

export type NewestReleaseLink = {
  version: string;
  splat: string;
  samePage: boolean;
};

export interface LoadedDoc {
  path: string;
  markdownUrl: string;
  pageTree: SerializedPageTree;
  version: string;
  newer: NewestReleaseLink | null;
}

const newestReleaseLink = (
  version: string,
  rest: string[]
): NewestReleaseLink => {
  const samePage =
    source.getPage([version, ...rest]) ?? findMovedPage([version, ...rest]);

  const versionIndex = `${docsRoute}/${version}`;

  return {
    version,
    splat: (samePage?.url ?? versionIndex).slice(docsRoute.length + 1),
    samePage: Boolean(samePage),
  };
};

export const loadDoc = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }): Promise<LoadedDoc> => {
    const page = source.getPage(slugs);

    if (!page) {
      const moved = findMovedPage(slugs);

      if (moved) throw redirect({ href: moved.url });

      throw notFound();
    }

    const version = page.slugs[0];
    const newest = newestRelease();

    return {
      path: page.path,
      markdownUrl: encodeMarkdownUrl(page.slugs, page.locale),
      pageTree: await source.serializePageTree(source.getPageTree()),
      version,
      newer:
        version === newest
          ? null
          : newestReleaseLink(newest, page.slugs.slice(1)),
    };
  });
