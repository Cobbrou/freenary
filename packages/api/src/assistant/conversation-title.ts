export const CONVERSATION_TITLE_CHARS = 80;

const WHITESPACE_RUN = /\s+/gu;

const ELLIPSIS = "…";

export interface QuestionPart {
  text?: string;
  type: string;
}

export const questionText = (parts: readonly QuestionPart[]): string =>
  parts
    .flatMap((part) =>
      part.type === "text" && part.text !== undefined ? [part.text] : []
    )
    .join(" ");

export const conversationTitle = (question: string): string | null => {
  const flattened = question.replaceAll(WHITESPACE_RUN, " ").trim();

  if (flattened.length === 0) {
    return null;
  }

  if (flattened.length <= CONVERSATION_TITLE_CHARS) {
    return flattened;
  }

  return `${flattened.slice(0, CONVERSATION_TITLE_CHARS - 1).trimEnd()}${ELLIPSIS}`;
};
