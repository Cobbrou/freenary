import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4FunctionTool,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
  SharedV4Warning,
} from "@ai-sdk/provider";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import { Effect, Match } from "effect";

import { BrowserGenerationFailed } from "./generation-failure";
import type { ParsedEvent } from "./tool-protocol";
import { toChatMessages, ToolCallParser } from "./tool-protocol";

interface OpenPart {
  id: string;
  kind: "text" | "reasoning";
}

interface WebLlmUsage {
  completion_tokens: number;
  prompt_tokens: number;
}

const UNREPORTED_USAGE: LanguageModelV4Usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: undefined,
    total: undefined,
  },
  outputTokens: {
    reasoning: undefined,
    text: undefined,
    total: undefined,
  },
};

const usageOf = (usage: WebLlmUsage): LanguageModelV4Usage => ({
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: undefined,
    total: usage.prompt_tokens,
  },
  outputTokens: {
    reasoning: undefined,
    text: undefined,
    total: usage.completion_tokens,
  },
});

const finishReasonOf = (
  raw: string | null | undefined,
  calledTools: boolean
): LanguageModelV4FinishReason => ({
  raw: raw ?? undefined,
  unified: calledTools
    ? "tool-calls"
    : Match.value(raw).pipe(
        Match.when("length", () => "length" as const),
        Match.when("stop", () => "stop" as const),
        Match.orElse(() => "other" as const)
      ),
});

export class WebLlmLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4";
  readonly provider = "webllm";
  readonly supportedUrls = {};
  readonly modelId: string;
  private readonly engine: MLCEngineInterface;

  constructor(engine: MLCEngineInterface, modelId: string) {
    this.engine = engine;
    this.modelId = modelId;
  }

  async doGenerate(
    options: LanguageModelV4CallOptions
  ): Promise<LanguageModelV4GenerateResult> {
    const { stream } = await this.doStream(options);
    const content: LanguageModelV4Content[] = [];
    const texts = new Map<
      string,
      { kind: "text" | "reasoning"; text: string }
    >();

    let finishReason: LanguageModelV4FinishReason = {
      raw: undefined,
      unified: "other",
    };

    let usage = UNREPORTED_USAGE;
    let warnings: SharedV4Warning[] = [];

    const startText = (id: string, kind: "text" | "reasoning") => {
      texts.set(id, { kind, text: "" });
    };

    const appendText = (id: string, delta: string) => {
      const open = texts.get(id);

      if (open) {
        open.text += delta;
      }
    };

    const endText = (id: string) => {
      const open = texts.get(id);

      if (open) {
        content.push({ text: open.text, type: open.kind });
        texts.delete(id);
      }
    };

    const absorb = Match.type<LanguageModelV4StreamPart>().pipe(
      Match.discriminators("type")({
        error: (part) => {
          throw part.error;
        },
        finish: (part) => {
          ({ finishReason, usage } = part);
        },
        "reasoning-delta": (part) => appendText(part.id, part.delta),
        "reasoning-end": (part) => endText(part.id),
        "reasoning-start": (part) => startText(part.id, "reasoning"),
        "stream-start": (part) => {
          ({ warnings } = part);
        },
        "text-delta": (part) => appendText(part.id, part.delta),
        "text-end": (part) => endText(part.id),
        "text-start": (part) => startText(part.id, "text"),
        "tool-call": (part) => {
          content.push(part);
        },
      }),
      Match.orElse(() => null)
    );

    for await (const part of stream) {
      absorb(part);
    }

    return { content, finishReason, usage, warnings };
  }

  async doStream(
    options: LanguageModelV4CallOptions
  ): Promise<LanguageModelV4StreamResult> {
    const { abortSignal, maxOutputTokens, prompt, temperature, toolChoice } =
      options;

    const warnings: SharedV4Warning[] = [];
    const tools: LanguageModelV4FunctionTool[] = [];

    for (const tool of options.tools ?? []) {
      if (tool.type === "function") {
        tools.push(tool);
      } else {
        warnings.push({
          details: "Provider-defined tools cannot run in the browser.",
          feature: `tool ${tool.id}`,
          type: "unsupported",
        });
      }
    }

    if (options.responseFormat?.type === "json") {
      warnings.push({
        details: "JSON output is not enforced by the browser model.",
        feature: "responseFormat",
        type: "unsupported",
      });
    }

    const messages = toChatMessages(prompt, tools, toolChoice);
    const { engine } = this;

    const chunks = await engine.chat.completions.create({
      extra_body: { enable_thinking: false },
      max_tokens: maxOutputTokens,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature,
    });

    const parser = new ToolCallParser();
    let open: OpenPart | null = null;
    let calledTools = false;
    let rawFinish: string | null | undefined;
    let usage: WebLlmUsage | undefined;

    const onAbort = () => {
      engine.interruptGenerate();
    };

    abortSignal?.addEventListener("abort", onAbort, { once: true });

    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      async start(controller) {
        const close = () => {
          if (open) {
            controller.enqueue({
              id: open.id,
              type: open.kind === "text" ? "text-end" : "reasoning-end",
            });

            open = null;
          }
        };

        const emit = (kind: "text" | "reasoning", delta: string) => {
          if (open && open.kind !== kind) {
            close();
          }

          const onlyWhitespaceSoFar = !open && delta.trim().length === 0;

          if (onlyWhitespaceSoFar) {
            return;
          }

          if (!open) {
            open = { id: crypto.randomUUID(), kind };
            controller.enqueue({
              id: open.id,
              type: kind === "text" ? "text-start" : "reasoning-start",
            });
          }

          controller.enqueue({
            delta,
            id: open.id,
            type: kind === "text" ? "text-delta" : "reasoning-delta",
          });
        };

        const handle = (events: ParsedEvent[]) => {
          for (const event of events) {
            if (event.kind === "tool-call") {
              close();
              calledTools = true;
              const id = `call_${crypto.randomUUID()}`;
              controller.enqueue({
                id,
                toolName: event.name,
                type: "tool-input-start",
              });

              controller.enqueue({
                delta: event.input,
                id,
                type: "tool-input-delta",
              });

              controller.enqueue({ id, type: "tool-input-end" });
              controller.enqueue({
                input: event.input,
                toolCallId: id,
                toolName: event.name,
                type: "tool-call",
              });
            } else {
              emit(event.kind, event.delta);
            }
          }
        };

        controller.enqueue({ type: "stream-start", warnings });

        const drain = Effect.tryPromise({
          catch: (cause) => new BrowserGenerationFailed({ cause }),
          try: async () => {
            for await (const chunk of chunks) {
              const [choice] = chunk.choices;

              if (choice?.delta.content) {
                handle(parser.push(choice.delta.content));
              }

              if (choice?.finish_reason) {
                rawFinish = choice.finish_reason;
              }

              if (chunk.usage) {
                ({ usage } = chunk);
              }
            }

            handle(parser.end());
            close();
            controller.enqueue({
              finishReason: finishReasonOf(
                abortSignal?.aborted ? "abort" : rawFinish,
                calledTools
              ),
              type: "finish",
              usage: usage === undefined ? UNREPORTED_USAGE : usageOf(usage),
            });
          },
        });

        await Effect.runPromise(
          drain.pipe(
            Effect.catch((error) =>
              Effect.sync(() => {
                controller.enqueue({ error: error.cause, type: "error" });
              })
            ),
            Effect.ensuring(
              Effect.sync(() => {
                abortSignal?.removeEventListener("abort", onAbort);
                controller.close();
              })
            )
          )
        );
      },
    });

    return { stream };
  }
}
