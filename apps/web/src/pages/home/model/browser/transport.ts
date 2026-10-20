import { assistantSystemPrompt } from "@freenary/api/assistant/prompt";
import { assistantTools } from "@freenary/api/assistant/tools";
import {
  answerableParts,
  isoDay,
  isStorableOutcome,
  isStoredPart,
  MAX_QUESTION_CHARS,
  MAX_STEPS,
} from "@freenary/api/assistant/turn";
import { ORPCError } from "@orpc/client";
import type { ChatTransport, Tool, UIMessage, UIMessageChunk } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { Data, Effect, Result } from "effect";
import type { ZodType } from "zod";
import { z } from "zod";

import type { client as apiClient } from "@/shared/api";

import { browserLanguageModel, CONTEXT_WINDOW_SIZE } from "./engine";
import { fitHistory, messageChars, promptBudgetChars } from "./history";

export interface BrowserChatTransportOptions {
  client: typeof apiClient;
  locale: () => string;
}

type SendMessagesOptions = Parameters<
  ChatTransport<UIMessage>["sendMessages"]
>[0];

class AssistantTurnSaveFailed extends Data.TaggedError(
  "AssistantTurnSaveFailed"
)<{
  readonly cause: unknown;
}> {}

const CONTEXT_OVERFLOW_MESSAGE = /context window/iu;

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error("browser_model_failed");

/* SAFETY: every `assistantTools` schema is a zod v4 object; the SDK's
   wider `FlexibleSchema` type is what hides that here. */
const toolSignatureChars = (tools: Record<string, Tool>): number =>
  Object.entries(tools).reduce(
    (total, [name, tool]) =>
      total +
      name.length +
      (tool.description?.length ?? 0) +
      JSON.stringify(z.toJSONSchema(tool.inputSchema as ZodType)).length,
    0
  );

const errorCode = (error: Error): string => {
  if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS") {
    return "rate_limited";
  }

  if (CONTEXT_OVERFLOW_MESSAGE.test(error.message)) {
    return "browser_model_context";
  }

  return error.message;
};

export const createBrowserChatTransport = ({
  client,
  locale,
}: BrowserChatTransportOptions): ChatTransport<UIMessage> => ({
  reconnectToStream: () => Promise.resolve(null),

  async sendMessages({
    abortSignal,
    chatId,
    messageId,
    messages,
    trigger,
  }: SendMessagesOptions): Promise<ReadableStream<UIMessageChunk>> {
    const model = browserLanguageModel();

    if (!model) {
      throw new Error("browser_model_not_loaded");
    }

    const question = messages.at(-1);

    if (
      !question ||
      question.role !== "user" ||
      question.parts.some((part) => part.type !== "text")
    ) {
      throw new Error("bad_request");
    }

    const asked = question.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n");

    if (asked.length > MAX_QUESTION_CHARS) {
      throw new Error("bad_request");
    }

    const accounts = await client.budget.getAccounts();
    const tools = assistantTools(client);
    const instructions = assistantSystemPrompt({
      firstTransactionDate: isoDay(accounts.firstTransactionDate),
      hasAccounts: accounts.hasAccounts,
      lastTransactionDate: isoDay(accounts.lastTransactionDate),
      locale: locale(),
      today: new Date().toISOString().slice(0, 10),
    });

    const replayable = messages.slice(0, -1).map((message) => ({
      ...message,
      parts: answerableParts(message.parts),
    }));

    const history = fitHistory(
      replayable,
      instructions.length + toolSignatureChars(tools) + messageChars(question),
      promptBudgetChars(CONTEXT_WINDOW_SIZE)
    );

    const originalMessages = [...history, question];

    const stream = streamText({
      abortSignal,
      instructions,
      messages: await convertToModelMessages(originalMessages),
      model,
      stopWhen: stepCountIs(MAX_STEPS),
      toolChoice: "auto",
      tools,
    });

    const answerId = crypto.randomUUID();

    return stream.toUIMessageStream({
      generateMessageId: () => answerId,
      onError: (thrown) => errorCode(asError(thrown)),
      onFinish: async ({ finishReason, isAborted, responseMessage }) => {
        const parts = answerableParts(responseMessage.parts).filter(
          isStoredPart
        );

        if (!isStorableOutcome({ finishReason, isAborted, parts })) {
          return;
        }

        const saved = await Effect.runPromise(
          Effect.result(
            Effect.tryPromise({
              catch: (cause) => new AssistantTurnSaveFailed({ cause }),
              try: () =>
                client.assistant.saveTurn({
                  answer: { id: answerId, parts },
                  conversationId: chatId,
                  question: question.parts.flatMap((part) =>
                    part.type === "text"
                      ? [{ text: part.text, type: "text" as const }]
                      : []
                  ),
                  regeneratedMessageId:
                    trigger === "regenerate-message" ? messageId : undefined,
                }),
            })
          )
        );

        if (Result.isFailure(saved)) {
          const { cause } = saved.failure;

          throw new Error(errorCode(asError(cause)), { cause });
        }
      },
      originalMessages,
    });
  },
});
