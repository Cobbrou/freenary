import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { SerializedPageTree } from "fumadocs-core/source/client";

import { markdownUrlOf, movedPageOf, source } from "@/shared/content";

export interface LoadedDoc {
  path: string;
  title: string;
  description: string;
  markdownUrl: string;
  pageTree: SerializedPageTree;
}

export const loadDoc = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }): Promise<LoadedDoc> => {
    const page = source.getPage(slugs);

    if (!page) {
      const moved = movedPageOf(slugs.join("/"));

      if (moved) throw redirect({ href: moved.url });

      throw notFound();
    }

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      markdownUrl: markdownUrlOf(page),
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });
