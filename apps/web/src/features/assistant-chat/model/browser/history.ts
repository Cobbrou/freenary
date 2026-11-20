import type { UIMessage } from "ai";

const CONSERVATIVE_CHARS_PER_TOKEN = 3;

const ANSWER_RESERVE_TOKENS = 1536;

export const promptBudgetChars = (contextWindowSize: number): number =>
  (contextWindowSize - ANSWER_RESERVE_TOKENS) * CONSERVATIVE_CHARS_PER_TOKEN;

export const messageChars = (message: UIMessage): number =>
  JSON.stringify(message.parts).length;

const firstQuestionAtOrAfter = (
  history: UIMessage[],
  index: number
): number => {
  let start = index;

  while (start < history.length && history[start]?.role !== "user") {
    start += 1;
  }

  return start;
};

export const fitHistory = (
  history: UIMessage[],
  fixedChars: number,
  budgetChars: number
): UIMessage[] => {
  let remaining = budgetChars - fixedChars;
  let newestThatFits = history.length;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];

    if (!message) {
      break;
    }

    remaining -= messageChars(message);

    if (remaining < 0) {
      break;
    }

    newestThatFits = index;
  }

  return history.slice(firstQuestionAtOrAfter(history, newestThatFits));
};
