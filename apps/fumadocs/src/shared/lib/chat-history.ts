import { isToolUIPart, type UIMessage } from "ai";

export const withoutToolParts = <Message extends UIMessage>(
  messages: Message[]
): Message[] =>
  messages.flatMap((message) => {
    const parts = message.parts.filter((part) => !isToolUIPart(part));

    return parts.length > 0 ? [{ ...message, parts }] : [];
  });
