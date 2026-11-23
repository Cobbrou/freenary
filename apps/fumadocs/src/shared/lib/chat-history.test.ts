import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import { chatHistory, recentExchanges } from "./chat-history";

const message = (role: "user" | "assistant", text: string): UIMessage => ({
  id: text,
  role,
  parts: [{ type: "text", text }],
});

const conversation = (questions: number): UIMessage[] =>
  Array.from({ length: questions }, (_, question) => [
    message("user", `q${question}`),
    message("assistant", `a${question}`),
  ])
    .flat()
    .concat(message("user", `q${questions}`));

const idsOf = (messages: UIMessage[]) => messages.map(({ id }) => id);

describe("recentExchanges", () => {
  test("keeps a short conversation whole", () => {
    expect(idsOf(recentExchanges(conversation(2), 4))).toEqual([
      "q0",
      "a0",
      "q1",
      "a1",
      "q2",
    ]);
  });

  test("keeps the last exchanges of a long conversation", () => {
    expect(idsOf(recentExchanges(conversation(30), 2))).toEqual([
      "q29",
      "a29",
      "q30",
    ]);
  });

  test("drops older exchanges past the length budget", () => {
    const messages = [
      message("user", "q0"),
      message("assistant", "a".repeat(500)),
      message("user", "q1"),
      message("assistant", "a1"),
      message("user", "q2"),
    ];

    expect(idsOf(recentExchanges(messages, 4, 300))).toEqual([
      "q1",
      "a1",
      "q2",
    ]);
  });

  test("always keeps the latest question", () => {
    const messages = [message("user", "q0"), message("user", "q".repeat(500))];

    expect(recentExchanges(messages, 4, 10)).toHaveLength(1);
  });

  test("drops assistant messages before the first question", () => {
    const messages = [message("assistant", "a0"), message("user", "q0")];

    expect(idsOf(recentExchanges(messages, 4))).toEqual(["q0"]);
  });
});

describe("chatHistory", () => {
  test("removes tool parts and trims an 11-question chat", () => {
    const messages = conversation(10).map((kept) =>
      kept.role === "assistant"
        ? {
            ...kept,
            parts: [
              {
                type: "tool-search" as const,
                toolCallId: `call-${kept.id}`,
                state: "output-available" as const,
                input: {},
                output: [],
              },
              ...kept.parts,
            ],
          }
        : kept
    );

    const history = chatHistory(messages);

    expect(idsOf(history)).toEqual(["q7", "a7", "q8", "a8", "q9", "a9", "q10"]);
    expect(
      history.flatMap(({ parts }) => parts).every(({ type }) => type === "text")
    ).toBe(true);
  });
});
