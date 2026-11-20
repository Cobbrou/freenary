import { describe, expect, it } from "bun:test";

import type { UIMessage } from "ai";

import { fitHistory, messageChars } from "./history";

const question = (id: string, text: string): UIMessage => ({
  id,
  parts: [{ text, type: "text" }],
  role: "user",
});

const answer = (id: string, text: string): UIMessage => ({
  id,
  parts: [{ text, type: "text" }],
  role: "assistant",
});

const transcript = [
  question("q1", "first ".repeat(20)),
  answer("a1", "one ".repeat(20)),
  question("q2", "second ".repeat(20)),
  answer("a2", "two ".repeat(20)),
  question("q3", "third"),
];

const size = (messages: UIMessage[]) =>
  messages.reduce((total, message) => total + messageChars(message), 0);

describe("fitHistory", () => {
  it("keeps everything when the budget covers it", () => {
    expect(fitHistory(transcript, 0, size(transcript))).toEqual(transcript);
  });

  it("drops the oldest turns as pairs, never starting on an answer", () => {
    const budgetShortOfTheSecondQuestion = size(transcript.slice(3)) + 1;

    expect(
      fitHistory(transcript, 0, budgetShortOfTheSecondQuestion).map((m) => m.id)
    ).toEqual(["q3"]);
  });

  it("keeps a whole turn once its question fits", () => {
    const budget = size(transcript.slice(2));

    expect(fitHistory(transcript, 0, budget).map((m) => m.id)).toEqual([
      "q2",
      "a2",
      "q3",
    ]);
  });

  it("charges the fixed prompt against the same budget", () => {
    const budget = size(transcript.slice(2));

    expect(fitHistory(transcript, 1, budget).map((m) => m.id)).toEqual(["q3"]);
  });
});
