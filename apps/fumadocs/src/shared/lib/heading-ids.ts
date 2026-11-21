const HEADING_ID_SUFFIX = /^(?<heading>#{1,6} .*?) \[#[\w-]+\]$/gmu;

export const withoutHeadingIds = (markdown: string): string =>
  markdown.replaceAll(HEADING_ID_SUFFIX, "$<heading>");
