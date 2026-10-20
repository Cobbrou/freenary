import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4Prompt,
  LanguageModelV4ToolChoice,
  LanguageModelV4ToolResultOutput,
} from "@ai-sdk/provider";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { Match, Option } from "effect";
import { z } from "zod";

export type ParsedEvent =
  | { kind: "text"; delta: string }
  | { kind: "reasoning"; delta: string }
  | { kind: "tool-call"; name: string; input: string };

type PromptMessage = LanguageModelV4Prompt[number];

type UserContent = Extract<PromptMessage, { role: "user" }>["content"];

type AssistantContent = Extract<
  PromptMessage,
  { role: "assistant" }
>["content"];

type ToolContent = Extract<PromptMessage, { role: "tool" }>["content"];

type ToolCallBody = z.infer<typeof toolCallBodySchema>;

type ToolCallArguments = NonNullable<ToolCallBody["arguments"]>;

interface ToolCall {
  input: string;
  name: string;
}

const TOOL_CALL_OPEN = "<tool_call>";
const TOOL_CALL_CLOSE = "</tool_call>";
const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";
const EMPTY_ARGUMENTS_JSON = "{}";

const OPENING_TAGS = [TOOL_CALL_OPEN, THINK_OPEN] as const;

const toolCallBodySchema = z.object({
  arguments: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .optional(),
  name: z.string().min(1),
});

const parseJson = Option.liftThrowable(JSON.parse);

const toolSignature = (tool: LanguageModelV4FunctionTool): string =>
  JSON.stringify({
    function: {
      description: tool.description,
      name: tool.name,
      parameters: tool.inputSchema,
    },
    type: "function",
  });

export const toolInstructions = (
  tools: readonly LanguageModelV4FunctionTool[],
  toolChoice: LanguageModelV4ToolChoice | undefined
): string =>
  [
    "# Tools",
    "",
    "You may call one or more functions to assist with the user query.",
    "",
    "You are provided with function signatures within <tools></tools> XML tags:",
    "<tools>",
    ...tools.map(toolSignature),
    "</tools>",
    "",
    "For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:",
    TOOL_CALL_OPEN,
    '{"name": <function-name>, "arguments": <args-json-object>}',
    TOOL_CALL_CLOSE,
    "",
    "Each result comes back inside <tool_response></tool_response> XML tags in the next user message. Once you have the results you need, answer the user in prose and call no further function; never call a function again with the same arguments, and never write a <tool_response> yourself.",
    ...(toolChoice?.type === "required"
      ? ["You must call at least one function before answering."]
      : []),
    ...(toolChoice?.type === "tool"
      ? [`You must call the function named ${toolChoice.toolName}.`]
      : []),
  ].join("\n");

const toolResultText = (output: LanguageModelV4ToolResultOutput): string =>
  Match.value(output).pipe(
    Match.discriminators("type")({
      content: ({ value }) =>
        value.map((part) => (part.type === "text" ? part.text : "")).join("\n"),
      "error-json": ({ value }) => JSON.stringify(value),
      "error-text": ({ value }) => value,
      "execution-denied": ({ reason }) =>
        JSON.stringify({ error: reason ?? "execution denied" }),
      json: ({ value }) => JSON.stringify(value),
      text: ({ value }) => value,
    }),
    Match.orElse(() => "")
  );

const userText = (content: UserContent): string =>
  content.map((part) => (part.type === "text" ? part.text : "")).join("\n");

const assistantText = (content: AssistantContent): string => {
  const lines: string[] = [];

  for (const part of content) {
    if (part.type === "text") {
      lines.push(part.text);
    } else if (part.type === "tool-call") {
      lines.push(
        `${TOOL_CALL_OPEN}\n${JSON.stringify({ arguments: part.input, name: part.toolName })}\n${TOOL_CALL_CLOSE}`
      );
    }
  }

  return lines.join("\n");
};

const toolResponsesText = (content: ToolContent): string =>
  content
    .flatMap((part) =>
      part.type === "tool-result"
        ? [
            `<tool_response>\n${JSON.stringify({ content: toolResultText(part.output), name: part.toolName })}\n</tool_response>`,
          ]
        : []
    )
    .join("\n");

const chatMessagesOf = (message: PromptMessage): ChatCompletionMessageParam[] =>
  Match.value(message).pipe(
    Match.discriminators("role")({
      assistant: (turn) => [
        { content: assistantText(turn.content), role: "assistant" as const },
      ],
      tool: (turn) => [
        { content: toolResponsesText(turn.content), role: "user" as const },
      ],
      user: (turn) => [
        { content: userText(turn.content), role: "user" as const },
      ],
    }),
    Match.orElse(() => [])
  );

export const toChatMessages = (
  prompt: LanguageModelV4Prompt,
  tools: readonly LanguageModelV4FunctionTool[],
  toolChoice: LanguageModelV4ToolChoice | undefined
): ChatCompletionMessageParam[] => {
  const offered = toolChoice?.type === "none" ? [] : tools;
  const system = prompt.find((message) => message.role === "system");
  const instructions = [
    ...(system ? [system.content] : []),
    ...(offered.length > 0 ? [toolInstructions(offered, toolChoice)] : []),
  ].join("\n\n");

  return [
    ...(instructions.length > 0
      ? [{ content: instructions, role: "system" as const }]
      : []),
    ...prompt.flatMap(chatMessagesOf),
  ];
};

const longestTagPrefix = (text: string): number => {
  let longest = 0;

  for (const tag of [...OPENING_TAGS, THINK_CLOSE, TOOL_CALL_CLOSE]) {
    const max = Math.min(tag.length - 1, text.length);

    for (let length = max; length > longest; length -= 1) {
      if (text.endsWith(tag.slice(0, length))) {
        longest = length;

        break;
      }
    }
  }

  return longest;
};

const toolCallInput = (args: ToolCallArguments): string => {
  const wrappedInJsonString = z.string().safeParse(args);

  if (!wrappedInJsonString.success) {
    return JSON.stringify(args);
  }

  return Option.isSome(parseJson(wrappedInJsonString.data))
    ? wrappedInJsonString.data
    : EMPTY_ARGUMENTS_JSON;
};

const parseToolCall = (body: string): Option.Option<ToolCall> =>
  Option.flatMap(parseJson(body.trim()), (json) => {
    const decoded = toolCallBodySchema.safeParse(json);

    if (!decoded.success) {
      return Option.none();
    }

    const { arguments: args = {}, name } = decoded.data;

    return Option.some({ input: toolCallInput(args), name });
  });

export class ToolCallParser {
  private buffer = "";
  private mode: "text" | "reasoning" | "tool-call" = "text";

  push(delta: string): ParsedEvent[] {
    this.buffer += delta;
    const events: ParsedEvent[] = [];

    for (;;) {
      if (this.mode === "tool-call") {
        const end = this.buffer.indexOf(TOOL_CALL_CLOSE);

        if (end === -1) {
          return events;
        }

        const body = this.buffer.slice(0, end);
        events.push(
          Option.match(parseToolCall(body), {
            onNone: () => ({
              delta: `${TOOL_CALL_OPEN}${body}${TOOL_CALL_CLOSE}`,
              kind: "text" as const,
            }),
            onSome: (call) => ({ kind: "tool-call" as const, ...call }),
          })
        );

        this.buffer = this.buffer.slice(end + TOOL_CALL_CLOSE.length);
        this.mode = "text";

        continue;
      }

      const closing = this.mode === "reasoning" ? THINK_CLOSE : undefined;
      const next = this.nextTag(closing);

      if (next === null) {
        const held = longestTagPrefix(this.buffer);
        const emit = this.buffer.slice(0, this.buffer.length - held);
        this.buffer = this.buffer.slice(this.buffer.length - held);

        if (emit.length > 0) {
          events.push({ delta: emit, kind: this.currentKind() });
        }

        return events;
      }

      const before = this.buffer.slice(0, next.index);

      if (before.length > 0) {
        events.push({ delta: before, kind: this.currentKind() });
      }

      this.buffer = this.buffer.slice(next.index + next.tag.length);

      if (next.tag === TOOL_CALL_OPEN) {
        this.mode = "tool-call";
      } else if (next.tag === THINK_OPEN) {
        this.mode = "reasoning";
      } else {
        this.mode = "text";
      }
    }
  }

  end(): ParsedEvent[] {
    if (this.buffer.length === 0) {
      return [];
    }

    const rest = this.buffer;
    this.buffer = "";

    if (this.mode === "tool-call") {
      this.mode = "text";

      return [{ delta: `${TOOL_CALL_OPEN}${rest}`, kind: "text" }];
    }

    return [{ delta: rest, kind: this.currentKind() }];
  }

  private currentKind(): "text" | "reasoning" {
    return this.mode === "reasoning" ? "reasoning" : "text";
  }

  private nextTag(
    closing: string | undefined
  ): { index: number; tag: string } | null {
    const candidates = closing ? [closing, TOOL_CALL_OPEN] : OPENING_TAGS;
    let found: { index: number; tag: string } | null = null;

    for (const tag of candidates) {
      const index = this.buffer.indexOf(tag);

      if (index !== -1 && (found === null || index < found.index)) {
        found = { index, tag };
      }
    }

    return found;
  }
}
