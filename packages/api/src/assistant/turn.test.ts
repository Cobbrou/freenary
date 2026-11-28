import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import {
  isFailedAnswer,
  isFailedOutcome,
  regeneratedTurnIds,
  replayableRows,
} from "./turn";

const answered: UIMessage["parts"] = [{ text: "1 200 €", type: "text" }];

const turn = (answerFailed: boolean) => [
  { failed: false, id: "q1", role: "USER" as const },
  { failed: false, id: "a1", role: "ASSISTANT" as const },
  { failed: false, id: "q2", role: "USER" as const },
  { failed: answerFailed, id: "a2", role: "ASSISTANT" as const },
];

describe("isFailedOutcome", () => {
  test("keeps a finished answer", () => {
    expect(
      isFailedOutcome({
        finishReason: "stop",
        isAborted: false,
        parts: answered,
      })
    ).toBe(false);
  });

  test("fails an answer that errored", () => {
    expect(
      isFailedOutcome({
        finishReason: "error",
        isAborted: false,
        parts: answered,
      })
    ).toBe(true);
  });

  test("fails an answer the stream left without a finish reason", () => {
    expect(
      isFailedOutcome({
        finishReason: undefined,
        isAborted: false,
        parts: answered,
      })
    ).toBe(true);
  });

  test("keeps a stopped answer with the text it had", () => {
    expect(
      isFailedOutcome({
        finishReason: undefined,
        isAborted: true,
        parts: answered,
      })
    ).toBe(false);
  });

  test("fails a stopped answer with no content", () => {
    expect(
      isFailedOutcome({
        finishReason: undefined,
        isAborted: true,
        parts: [{ type: "step-start" }],
      })
    ).toBe(true);
  });
});

describe("isFailedAnswer", () => {
  test("reads the failed flag getConversation sets", () => {
    expect(
      isFailedAnswer({
        id: "a1",
        metadata: { failed: true },
        parts: [],
        role: "assistant",
      })
    ).toBe(true);

    expect(
      isFailedAnswer({
        id: "a1",
        metadata: { failed: false },
        parts: answered,
        role: "assistant",
      })
    ).toBe(false);

    expect(
      isFailedAnswer({ id: "a1", parts: answered, role: "assistant" })
    ).toBe(false);
  });
});

describe("regeneratedTurnIds", () => {
  test("replaces the trailing turn whose answer is regenerated", () => {
    expect(regeneratedTurnIds(turn(false), { messageId: "a2" })).toEqual([
      "q2",
      "a2",
    ]);
  });

  test("replaces a failed trailing turn on Retry after a reload", () => {
    expect(regeneratedTurnIds(turn(true), {})).toEqual(["q2", "a2"]);
  });

  test("keeps a failed trailing turn when a new question is asked", () => {
    expect(regeneratedTurnIds(turn(true), null)).toEqual([]);
  });

  test("keeps an answered trailing turn when Retry names no message", () => {
    expect(regeneratedTurnIds(turn(false), {})).toEqual([]);
  });
});

describe("replayableRows", () => {
  test("leaves out failed answers and keeps their questions", () => {
    expect(replayableRows(turn(true), []).map((row) => row.id)).toEqual([
      "q1",
      "a1",
      "q2",
    ]);
  });

  test("leaves out the turn being regenerated", () => {
    expect(
      replayableRows(turn(true), ["q2", "a2"]).map((row) => row.id)
    ).toEqual(["q1", "a1"]);
  });
});
