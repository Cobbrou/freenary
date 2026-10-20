import { auth } from "@freenary/auth";
import { AI_CHAT_RATE_LIMIT } from "@freenary/auth/policy";
import { createRouterClient } from "@orpc/server";
import type { UIMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { Data, Effect, Match } from "effect";
import type { RequestLogger } from "evlog";
import { createAILogger } from "evlog/ai";
import { z } from "zod";

import { consumeRateLimit } from "../lib/rate-limit";
import { appRouter } from "../routers/index";
import {
  activeConversation,
  appendTurn,
  conversationMessages,
} from "./conversation";
import { assistantSystemPrompt } from "./prompt";
import { assistantModel } from "./provider";
import { assistantTools } from "./tools";
import {
  answerableParts,
  isoDay,
  isStorableOutcome,
  LOCALE,
  MAX_QUESTION_CHARS,
  MAX_STEPS,
  regeneratedTurnIds,
} from "./turn";

export interface AssistantChatOptions {
  request: Request;
  log: RequestLogger;
}

type ChatRefusalReason =
  | { readonly kind: "rate-limited"; readonly cause: unknown }
  | { readonly kind: "malformed-body"; readonly cause: unknown }
  | { readonly kind: "question-too-long"; readonly chars: number };

class ChatRequestRefused extends Data.TaggedError("ChatRequestRefused")<{
  readonly reason: ChatRefusalReason;
}> {}

const questionSchema = z.looseObject({
  id: z.string().optional(),
  parts: z.array(z.object({ text: z.string(), type: z.literal("text") })),
  role: z.literal("user"),
});

const chatRequestSchema = z.object({
  locale: z.string().regex(LOCALE).optional(),
  messageId: z.string().optional(),
  messages: z.array(z.looseObject({ role: z.string() })).default([]),
  trigger: z.string().optional(),
});

const REGENERATE_TRIGGER = "regenerate-message";

const refusalResponse = Match.type<ChatRefusalReason>().pipe(
  Match.discriminatorsExhaustive("kind")({
    "malformed-body": () => new Response("bad_request", { status: 400 }),
    "question-too-long": () => new Response("bad_request", { status: 400 }),
    "rate-limited": () => new Response("rate_limited", { status: 429 }),
  })
);

const postedText = (question: z.infer<typeof questionSchema>): string =>
  question.parts.map((part) => part.text).join("\n");

const admitChatRequest = Effect.fnUntraced(
  function* admit(request: Request, userId: string) {
    yield* Effect.tryPromise({
      catch: (cause) =>
        new ChatRequestRefused({ reason: { cause, kind: "rate-limited" } }),
      try: () => consumeRateLimit(`ai-chat:${userId}`, AI_CHAT_RATE_LIMIT),
    });

    const payload = yield* Effect.tryPromise({
      catch: (cause) =>
        new ChatRequestRefused({ reason: { cause, kind: "malformed-body" } }),
      try: () => request.json(),
    });

    const parsedBody = chatRequestSchema.safeParse(payload);

    if (!parsedBody.success) {
      return yield* new ChatRequestRefused({
        reason: { cause: parsedBody.error, kind: "malformed-body" },
      });
    }

    const parsedQuestion = questionSchema.safeParse(
      parsedBody.data.messages.at(-1)
    );

    if (!parsedQuestion.success) {
      return yield* new ChatRequestRefused({
        reason: { cause: parsedQuestion.error, kind: "malformed-body" },
      });
    }

    const chars = postedText(parsedQuestion.data).length;

    if (chars > MAX_QUESTION_CHARS) {
      return yield* new ChatRequestRefused({
        reason: { chars, kind: "question-too-long" },
      });
    }

    return { body: parsedBody.data, question: parsedQuestion.data };
  },
  Effect.catchTag("ChatRequestRefused", (refused) =>
    Effect.succeed(refusalResponse(refused.reason))
  )
);

export const handleAssistantChat = async ({
  log,
  request,
}: AssistantChatOptions): Promise<Response> => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return new Response("unauthorized", { status: 401 });
  }

  const model = assistantModel();

  if (!model) {
    return new Response("unconfigured", { status: 503 });
  }

  const admitted = await Effect.runPromise(
    admitChatRequest(request, session.user.id)
  );

  if (admitted instanceof Response) {
    return admitted;
  }

  const { body, question: postedQuestion } = admitted;

  const api = createRouterClient(appRouter, {
    context: { auth: null, headers: request.headers, session },
  });

  const [conversation, accounts] = await Promise.all([
    activeConversation(session.user.id),
    api.budget.getAccounts(),
  ]);

  const stored = await conversationMessages(conversation.id);

  /* SAFETY: `postedQuestion` was parsed as a user message carrying only text
     parts, which is a structurally valid `UIMessage` for the SDK. */
  const question = postedQuestion as UIMessage;
  const replaceMessageIds = regeneratedTurnIds(
    stored,
    body.trigger === REGENERATE_TRIGGER ? body.messageId : undefined
  );

  const replayableHistory =
    replaceMessageIds.length > 0 ? stored.slice(0, -2) : stored;

  /* SAFETY: the stream route writes `UIMessage.parts` as produced, and the only
     other writer, `assistant.saveTurn`, admits parts through `answerPartSchema`
     in `routers/assistant.ts`: each a plain object whose `type` is a string,
     which is the whole of what `UIMessage["parts"]` guarantees structurally. */
  const history = replayableHistory.map(
    (row) =>
      ({
        id: row.id,
        parts: row.parts,
        role: row.role === "USER" ? "user" : "assistant",
      }) as UIMessage
  );

  const originalMessages = [...history, question];

  const ai = createAILogger(log);

  const stream = streamText({
    abortSignal: request.signal,
    instructions: assistantSystemPrompt({
      firstTransactionDate: isoDay(accounts.firstTransactionDate),
      hasAccounts: accounts.hasAccounts,
      lastTransactionDate: isoDay(accounts.lastTransactionDate),
      locale: body.locale ?? "en",
      today: new Date().toISOString().slice(0, 10),
    }),
    messages: await convertToModelMessages(originalMessages),
    model: ai.wrap(model),
    stopWhen: stepCountIs(MAX_STEPS),
    toolChoice: "auto",
    tools: assistantTools(api),
  });

  const answerId = crypto.randomUUID();

  return stream.toUIMessageStreamResponse({
    generateMessageId: () => answerId,
    onFinish: ({ finishReason, isAborted, responseMessage }) => {
      const parts = answerableParts(responseMessage.parts);

      if (!isStorableOutcome({ finishReason, isAborted, parts })) {
        return;
      }

      return appendTurn(conversation.id, question.parts, parts, {
        answerId,
        replaceMessageIds,
      });
    },
    originalMessages,
  });
};
