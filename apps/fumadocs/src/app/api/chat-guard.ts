import { safeValidateUIMessages } from "ai";
import { z } from "zod";

import type { ChatUIMessage } from "@/shared/ui/ai-search";

const MAX_BODY_LENGTH = 32_000;

const MAX_MESSAGES = 20;

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const MAX_REQUESTS_PER_CALLER = 20;

const MAX_REQUESTS_PER_WINDOW = 300;

const chatRequestBody = z.object({
  version: z.string().optional(),
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant"]) }))
    .min(1)
    .max(MAX_MESSAGES),
});

export type ChatRequest = {
  version: string | undefined;
  messages: ChatUIMessage[];
};

let windowStart = 0;
let requestsInWindow = 0;
const requestsByCaller = new Map<string, number>();

const isOverRateLimit = (caller: string): boolean => {
  const now = Date.now();

  if (now - windowStart >= RATE_LIMIT_WINDOW_MS) {
    windowStart = now;
    requestsInWindow = 0;
    requestsByCaller.clear();
  }

  const callerRequests = (requestsByCaller.get(caller) ?? 0) + 1;
  requestsByCaller.set(caller, callerRequests);
  requestsInWindow += 1;

  return (
    callerRequests > MAX_REQUESTS_PER_CALLER ||
    requestsInWindow > MAX_REQUESTS_PER_WINDOW
  );
};

const callerOfVercelRequest = (request: Request): string =>
  request.headers.get("x-real-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

export const guardChatRequest = async (
  request: Request
): Promise<ChatRequest | Response> => {
  if (isOverRateLimit(callerOfVercelRequest(request))) {
    return new Response("rate_limited", { status: 429 });
  }

  const text = await request.text();

  if (text.length > MAX_BODY_LENGTH) {
    return new Response("body_too_large", { status: 413 });
  }

  const json: unknown = await new Response(text).json().catch(() => undefined);

  const body = chatRequestBody.safeParse(json);

  if (!body.success) {
    return new Response("invalid_body", { status: 400 });
  }

  const messages = await safeValidateUIMessages<ChatUIMessage>({
    messages: body.data.messages,
    dataSchemas: { client: z.object({ location: z.string() }) },
  });

  if (!messages.success) {
    return new Response("invalid_body", { status: 400 });
  }

  return { version: body.data.version, messages: messages.data };
};
