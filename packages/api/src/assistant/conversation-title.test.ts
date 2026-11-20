import { describe, expect, test } from "bun:test";

import {
  CONVERSATION_TITLE_CHARS,
  conversationTitle,
  questionText,
} from "./conversation-title";

describe("conversationTitle", () => {
  test("keeps a short question as it was asked", () => {
    expect(conversationTitle("Can I afford a €600 weekend in Lisbon?")).toBe(
      "Can I afford a €600 weekend in Lisbon?"
    );
  });

  test("folds line breaks and runs of spaces into one space", () => {
    expect(conversationTitle("  Where did\n\nOctober   go?  ")).toBe(
      "Where did October go?"
    );
  });

  test("cuts a long question at the limit and marks the cut", () => {
    const title = conversationTitle("word ".repeat(40));

    expect(title?.length).toBeLessThanOrEqual(CONVERSATION_TITLE_CHARS);
    expect(title?.endsWith("…")).toBe(true);
  });

  test("names nothing for a blank question", () => {
    expect(conversationTitle(" \n ")).toBeNull();
  });
});

describe("questionText", () => {
  test("joins the text parts and skips the rest", () => {
    expect(
      questionText([
        { text: "Where did", type: "text" },
        { type: "step-start" },
        { text: "October go?", type: "text" },
      ])
    ).toBe("Where did October go?");
  });

  test("reads nothing from parts that carry no text", () => {
    expect(questionText([{ type: "step-start" }, { type: "text" }])).toBe("");
  });
});
