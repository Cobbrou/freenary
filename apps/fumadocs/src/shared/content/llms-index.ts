import { docsRoute } from "../config/site";

const MARKDOWN_LINK_DESTINATION = /\]\(([^)\s]+)/g;

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

const llmsIndexFiles = import.meta.glob<string>(
  "../../../../../docs/llms.txt",
  {
    eager: true,
    import: "default",
    query: "?raw",
  }
);

export const llmsIndex: string | undefined = Object.values(llmsIndexFiles)[0];

export const withAbsoluteLlmsLinks = (text: string, origin: string): string => {
  const base = `${origin}${docsRoute}/`;

  return text.replaceAll(MARKDOWN_LINK_DESTINATION, (link, href: string) =>
    URL_SCHEME.test(href) || href.startsWith("#")
      ? link
      : `](${new URL(href, base).href}`
  );
};
