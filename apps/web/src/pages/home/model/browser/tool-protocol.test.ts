import { describe, expect, it } from "bun:test";

import { toChatMessages, ToolCallParser } from "./tool-protocol";
import type { ParsedEvent } from "./tool-protocol";

const collect = (chunks: string[]): ParsedEvent[] => {
  const parser = new ToolCallParser();
  const events = chunks.flatMap((chunk) => parser.push(chunk));

  return [...events, ...parser.end()];
};

const text = (events: ParsedEvent[]): string =>
  events
    .flatMap((event) => (event.kind === "text" ? [event.delta] : []))
    .join("");

describe("ToolCallParser", () => {
  it("emits a tool call whose tags were split across chunks", () => {
    const events = collect([
      "Let me check.\n<tool_",
      'call>\n{"name": "get_cash_flow", "arguments": {"from": "2026-01-01", ',
      '"to": "2026-01-31"}}\n</tool_',
      "call>",
    ]);

    expect(text(events)).toBe("Let me check.\n");
    expect(events.at(-1)).toEqual({
      input: JSON.stringify({ from: "2026-01-01", to: "2026-01-31" }),
      kind: "tool-call",
      name: "get_cash_flow",
    });
  });

  it("does not emit an angle bracket that never became a tag", () => {
    const events = collect(["a < b and 1 <", "2"]);

    expect(text(events)).toBe("a < b and 1 <2");
  });

  it("separates reasoning from prose and unwraps string arguments", () => {
    const events = collect([
      "<think>needs a lookup</think>Sure.",
      '<tool_call>{"name":"get_accounts_overview","arguments":"{}"}</tool_call>',
    ]);

    expect(events).toEqual([
      { delta: "needs a lookup", kind: "reasoning" },
      { delta: "Sure.", kind: "text" },
      { input: "{}", kind: "tool-call", name: "get_accounts_overview" },
    ]);
  });

  it("keeps a malformed or unfinished tool call as prose", () => {
    expect(text(collect(["<tool_call>not json</tool_call> done"]))).toBe(
      "<tool_call>not json</tool_call> done"
    );

    expect(text(collect(['<tool_call>{"name":']))).toBe('<tool_call>{"name":');
  });
});

describe("toChatMessages", () => {
  it("folds tool calls and results into text turns the template can render", () => {
    const messages = toChatMessages(
      [
        { content: "Be brief.", role: "system" },
        { content: [{ text: "How much?", type: "text" }], role: "user" },
        {
          content: [
            {
              input: { from: "2026-01-01", to: "2026-01-31" },
              toolCallId: "call_1",
              toolName: "get_cash_flow",
              type: "tool-call",
            },
          ],
          role: "assistant",
        },
        {
          content: [
            {
              output: { type: "json", value: { periods: [] } },
              toolCallId: "call_1",
              toolName: "get_cash_flow",
              type: "tool-result",
            },
          ],
          role: "tool",
        },
      ],
      [
        {
          description: "Cash flow",
          inputSchema: { type: "object" },
          name: "get_cash_flow",
          type: "function",
        },
      ],
      { type: "auto" }
    );

    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);

    expect(messages[0]?.content).toStartWith("Be brief.\n\n# Tools");
    expect(messages[0]?.content).toContain('"name":"get_cash_flow"');
    expect(messages[2]?.content).toBe(
      '<tool_call>\n{"arguments":{"from":"2026-01-01","to":"2026-01-31"},"name":"get_cash_flow"}\n</tool_call>'
    );

    expect(messages[3]?.content).toBe(
      '<tool_response>\n{"content":"{\\"periods\\":[]}","name":"get_cash_flow"}\n</tool_response>'
    );
  });

  it("offers no tools when the choice is none", () => {
    const [system] = toChatMessages(
      [{ content: "Be brief.", role: "system" }],
      [
        {
          inputSchema: { type: "object" },
          name: "get_cash_flow",
          type: "function",
        },
      ],
      { type: "none" }
    );

    expect(system?.content).toBe("Be brief.");
  });
});
