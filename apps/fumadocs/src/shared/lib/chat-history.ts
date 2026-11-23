import { isToolUIPart, type UIMessage } from "ai";

export const MAX_USER_MESSAGE_LENGTH = 2000;

export const MAX_HISTORY_EXCHANGES = 4;

export const MAX_HISTORY_LENGTH = 24_000;

export const withoutToolParts = <Message extends UIMessage>(
  messages: Message[]
): Message[] =>
  messages.flatMap((message) => {
    const parts = message.parts.filter((part) => !isToolUIPart(part));

    return parts.length > 0 ? [{ ...message, parts }] : [];
  });

export const userTextLength = (message: UIMessage): number =>
  message.parts.reduce(
    (length, part) =>
      part.type === "text" ? length + part.text.length : length,
    0
  );

export const recentExchanges = <Message extends UIMessage>(
  messages: Message[],
  maxExchanges: number = MAX_HISTORY_EXCHANGES,
  maxLength: number = MAX_HISTORY_LENGTH
): Message[] => {
  let start = messages.length;
  let exchanges = 0;
  let length = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message === undefined) continue;

    length += JSON.stringify(message).length;

    if (message.role !== "user") continue;

    exchanges += 1;

    if (exchanges > 1 && (exchanges > maxExchanges || length > maxLength)) {
      break;
    }

    start = index;
  }

  return messages.slice(start);
};

export const chatHistory = <Message extends UIMessage>(
  messages: Message[]
): Message[] => recentExchanges(withoutToolParts(messages));
