import { Document, type DocumentData } from "flexsearch";

export const MAX_SEARCH_RESULTS = 5;

const EXCERPT_LENGTH = 500;

export const MAX_SECTION_LENGTH = 4000;

const URL_BASE = "https://docs.invalid";

interface Section extends DocumentData {
  id: string;
  url: string;
  title: string;
  description: string;
  content: string;
}

export type SearchResult = {
  url: string;
  title: string;
  description: string;
  excerpt: string;
};

export type ReadResult =
  | {
      found: true;
      url: string;
      title: string;
      description: string;
      content: string;
      truncated: boolean;
    }
  | { found: false; error: string };

export type IndexedPage = {
  url: string;
  title: string;
  description: string;
  structuredData: {
    headings: { id: string; content: string }[];
    contents: { heading: string | undefined; content: string }[];
  };
};

export const sectionsOf = (page: IndexedPage): Section[] => {
  const headingText = new Map(
    page.structuredData.headings.map((heading) => [heading.id, heading.content])
  );

  const paragraphsByHeading = new Map<string | undefined, string[]>();

  for (const { heading, content } of page.structuredData.contents) {
    paragraphsByHeading.set(heading, [
      ...(paragraphsByHeading.get(heading) ?? []),
      content,
    ]);
  }

  return [...paragraphsByHeading].map(([heading, paragraphs]) => {
    const url = heading === undefined ? page.url : `${page.url}#${heading}`;
    const headingTitle =
      heading === undefined ? undefined : headingText.get(heading);

    return {
      id: url,
      url,
      title:
        headingTitle === undefined
          ? page.title
          : `${page.title} › ${headingTitle}`,
      description: page.description,
      content: paragraphs.join("\n"),
    };
  });
};

export const createSectionIndex = (pages: IndexedPage[]) => {
  const index = new Document<Section>({
    document: {
      id: "id",
      index: ["title", "description", "content"],
      store: true,
    },
  });

  for (const section of pages.flatMap(sectionsOf)) {
    index.add(section);
  }

  return index;
};

const sectionPathOf = (url: string): string | undefined => {
  if (!URL.canParse(url, URL_BASE)) return undefined;

  const { pathname, hash } = new URL(url, URL_BASE);

  return `${pathname.replace(/(?<=.)\/+$/, "")}${hash}`;
};

export const readSection = (
  index: Document<Section>,
  url: string
): ReadResult => {
  const path = sectionPathOf(url);
  const section =
    index.get(url) ?? (path === undefined ? null : index.get(path));

  if (!section) {
    return {
      found: false,
      error: `No docs section at "${url}". Use a \`url\` from the \`search\` results.`,
    };
  }

  return {
    found: true,
    url: section.url,
    title: section.title,
    description: section.description,
    content: section.content.slice(0, MAX_SECTION_LENGTH),
    truncated: section.content.length > MAX_SECTION_LENGTH,
  };
};

export const searchSections = async (
  index: Document<Section>,
  query: string,
  limit: number
): Promise<SearchResult[]> => {
  const cappedLimit = Math.min(limit, MAX_SEARCH_RESULTS);
  const results = await index.searchAsync(query, {
    limit: cappedLimit,
    merge: true,
    enrich: true,
  });

  return results.slice(0, cappedLimit).flatMap(({ doc }) =>
    doc
      ? [
          {
            url: doc.url,
            title: doc.title,
            description: doc.description,
            excerpt: doc.content.slice(0, EXCERPT_LENGTH),
          },
        ]
      : []
  );
};
