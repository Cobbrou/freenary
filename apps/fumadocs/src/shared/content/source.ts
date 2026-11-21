import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

import { docsRoute } from "../config/site";

const pageWithTitleAndDescription = pageSchema.extend({
  title: z.string().min(1),
  description: z.string().min(1),
});

export const docs = defineDocs({
  dir: "../../docs",
  docs: {
    async: true,
    files: ["**/*.md"],
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageWithTitleAndDescription,
  },
  meta: {
    files: ["**/meta.json"],
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
});

export type DocsPage = (typeof source)["$inferPage"];

let pagesByPath: Map<string, DocsPage> | undefined;

export const pageAtFile = (path: string): DocsPage | undefined => {
  pagesByPath ??= new Map(source.getPages().map((page) => [page.path, page]));

  return pagesByPath.get(path);
};

export const markdownUrlOf = (page: DocsPage): string =>
  `${docsRoute}/${page.path}`;
