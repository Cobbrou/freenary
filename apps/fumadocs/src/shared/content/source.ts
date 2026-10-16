import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

import { MOVED_PAGES, type MovedPage } from "../config/moved-pages";
import { docsRoute } from "../config/site";
import { compareVersionIds, isVersionId, NEXT_VERSION } from "../lib/versions";

const UNVERSIONED_DOCS_LINK = /(\]\(|href=")\/docs\//g;

const pageWithDescriptionAndIcon = pageSchema.extend({
  description: z.string().min(1),
  icon: z.string().min(1),
});

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageWithDescriptionAndIcon,
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [lucideIconsPlugin()],
});

const once = <T>(compute: () => T) => {
  let computed: T | undefined;

  return (): T => (computed ??= compute());
};

export const listVersions = once((): string[] =>
  [...new Set(source.getPages().map((page) => page.slugs[0]))]
    .filter(isVersionId)
    .sort(compareVersionIds)
);

export const newestRelease = (): string =>
  listVersions().find((id) => id !== NEXT_VERSION) ?? NEXT_VERSION;

export const versionNode = (version: string) =>
  source
    .getPageTree()
    .children.find(
      (child) => child.type === "folder" && child.name === version
    );

const pageAt = (version: string, path: string) =>
  source.getPage([version, ...path.split("/")]);

const counterpartOf = (
  path: string,
  [before, after]: MovedPage
): string | undefined => {
  if (before === path) {
    return after;
  }

  if (after === path) {
    return before;
  }

  return undefined;
};

export const findMovedPage = (slugs: readonly string[]) => {
  const [version, ...rest] = slugs;
  const path = rest.join("/");

  if (version === undefined || path === "") {
    return undefined;
  }

  for (const moved of MOVED_PAGES) {
    const counterpart = counterpartOf(path, moved);
    const page =
      counterpart === undefined ? undefined : pageAt(version, counterpart);

    if (page) {
      return page;
    }
  }

  return undefined;
};

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed");
  const versioned = processed.replace(
    UNVERSIONED_DOCS_LINK,
    `$1${docsRoute}/${page.slugs[0]}/`
  );

  return `# ${page.data.title} (${page.url})

${versioned}`;
}
