import type {
  ReasoningUIPart,
  StepStartUIPart,
  TextUIPart,
  ToolUIPart,
  UIMessage,
} from "ai";
import { Predicate } from "effect";

export type StoredPart =
  | ReasoningUIPart
  | StepStartUIPart
  | TextUIPart
  | ToolUIPart;

interface StoredRow {
  id: string;
  role: "USER" | "ASSISTANT";
}

export const MAX_QUESTION_CHARS = 8000;

export const MAX_STEPS = 6;

export const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/u;

const TOOL_PART_PREFIX = "tool-";

const REPLAYABLE_TOOL_STATES = {
  "output-available": true,
  "output-error": true,
};

const FAILED_FINISH_REASON = "error";

const isToolPart = (part: UIMessage["parts"][number]): boolean =>
  part.type.startsWith(TOOL_PART_PREFIX);

const isReplayableToolPart = (part: UIMessage["parts"][number]): boolean =>
  !Predicate.hasProperty(part, "state") ||
  (Predicate.isString(part.state) &&
    Object.hasOwn(REPLAYABLE_TOOL_STATES, part.state));

export const isoDay = (date: Date | string | null): string | null =>
  date === null ? null : new Date(date).toISOString().slice(0, 10);

export const isStoredPart = (
  part: UIMessage["parts"][number]
): part is StoredPart =>
  part.type === "text" ||
  part.type === "reasoning" ||
  part.type === "step-start" ||
  isToolPart(part);

export const answerableParts = (
  parts: UIMessage["parts"]
): UIMessage["parts"] =>
  parts.filter((part) => !isToolPart(part) || isReplayableToolPart(part));

export const hasContent = (parts: UIMessage["parts"]): boolean =>
  parts.some(
    (part) =>
      isToolPart(part) || (part.type === "text" && part.text.trim().length > 0)
  );

export const isStorableOutcome = ({
  finishReason,
  isAborted,
  parts,
}: {
  finishReason: string | undefined;
  isAborted: boolean;
  parts: UIMessage["parts"];
}): boolean =>
  !(
    isAborted ||
    finishReason === undefined ||
    finishReason === FAILED_FINISH_REASON ||
    !hasContent(parts)
  );

export const regeneratedTurnIds = (
  stored: readonly StoredRow[],
  regeneratedMessageId: string | undefined
): string[] => {
  const trailingAnswer = stored.at(-1);
  const trailingQuestion = stored.at(-2);

  return regeneratedMessageId !== undefined &&
    trailingAnswer?.id === regeneratedMessageId &&
    trailingAnswer.role === "ASSISTANT" &&
    trailingQuestion?.role === "USER"
    ? [trailingQuestion.id, trailingAnswer.id]
    : [];
};
