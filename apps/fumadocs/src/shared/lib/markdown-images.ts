const MARKDOWN_IMAGE =
  /!\[[^\]]*\]\(\s*<?(?<target>[^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/gu;

const FENCE = /^(?:```|~~~)[\s\S]*?^(?:```|~~~)/gmu;

const IMAGE_PLACEHOLDER = /<img\b(?<attributes>[^>]*?)\/?>/gu;

const PLACEHOLDER_SOURCE = /\bsrc="__img(?<index>\d+)"/u;

const ALT_ATTRIBUTE = /\balt="(?<alt>[^"]*)"/u;

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
  "&#39;": "'",
};

const HTML_ENTITY = /&(?:amp|gt|lt|quot|#39);/gu;

const decodeEntities = (text: string): string =>
  text.replaceAll(HTML_ENTITY, (entity) => HTML_ENTITIES[entity] ?? entity);

export const imageTargetsOf = (markdown: string): string[] =>
  [...markdown.replaceAll(FENCE, "").matchAll(MARKDOWN_IMAGE)].map(
    (match) => match.groups?.target ?? ""
  );

export const resolveRelativePath = (
  fromFile: string,
  target: string
): string => {
  const segments = fromFile.split("/").slice(0, -1);

  for (const part of target.split("/")) {
    if (part === "..") {
      segments.pop();
    } else if (part !== "." && part !== "") {
      segments.push(part);
    }
  }

  return segments.join("/");
};

export const withMarkdownImages = (
  processed: string,
  targets: readonly string[],
  urlOf: (target: string) => string
): string =>
  processed.replaceAll(IMAGE_PLACEHOLDER, (tag, attributes: string) => {
    const index = PLACEHOLDER_SOURCE.exec(attributes)?.groups?.index;
    const target = index === undefined ? undefined : targets[Number(index)];

    if (target === undefined) {
      return tag;
    }

    const alt = decodeEntities(
      ALT_ATTRIBUTE.exec(attributes)?.groups?.alt ?? ""
    );

    return `![${alt}](${urlOf(target)})`;
  });
