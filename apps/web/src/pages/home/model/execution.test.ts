import { describe, expect, it } from "bun:test";

import type { ToolUIPart, UIMessage } from "ai";

import { activityOf, toolStatusOf, traceOf } from "./execution";

/* SAFETY: the SDK's tool part union needs every generic field filled in; a
   test fixture carries only what `traceOf` and `toolStatusOf` read. */
const tool = (state: ToolUIPart["state"], id = "call_1"): ToolUIPart =>
  ({
    input: { from: "2026-06-01", to: "2026-08-31" },
    state,
    toolCallId: id,
    type: "tool-get_cash_flow",
  }) as ToolUIPart;

const step: UIMessage["parts"][number] = { type: "step-start" };

const text = (value: string): UIMessage["parts"][number] => ({
  text: value,
  type: "text",
});

describe("traceOf", () => {
  it("groups parts by step and counts the lookups", () => {
    const trace = traceOf(
      [
        step,
        { state: "done", text: "Two", type: "reasoning" },
        { state: "done", text: "lookups.", type: "reasoning" },
        tool("output-available", "a"),
        tool("output-available", "b"),
        step,
        text("Done."),
      ],
      false
    );

    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0]?.thinking).toEqual({
      keys: ["reasoning-1", "reasoning-2"],
      state: "done",
      text: "Two\n\nlookups.",
    });

    expect(trace.steps[1]?.answer).toEqual([
      { kind: "markdown", text: "Done." },
    ]);

    expect(trace.lookups).toBe(2);
    expect(trace.steps.map((entry) => entry.status)).toEqual([
      "complete",
      "complete",
    ]);
  });

  it("marks the last step active and the answer pending while live", () => {
    const trace = traceOf([step, tool("input-available")], true);

    expect(trace.steps[0]?.status).toBe("active");
    expect(trace.answerPending).toBe(true);
  });

  it("does not expect an answer once the stream ended", () => {
    expect(traceOf([step, tool("input-available")], false).answerPending).toBe(
      false
    );
  });

  it("opens an implicit step for parts before the first marker", () => {
    expect(traceOf([text("Hello")], false).steps).toHaveLength(1);
  });
});

describe("toolStatusOf", () => {
  it("reads a waiting call as cancelled once the stream ended", () => {
    expect(toolStatusOf(tool("input-available"), true)).toBe("running");
    expect(toolStatusOf(tool("input-available"), false)).toBe("cancelled");
    expect(toolStatusOf(tool("input-streaming"), false)).toBe("cancelled");
  });

  it("keeps settled calls settled either way", () => {
    expect(toolStatusOf(tool("output-available"), false)).toBe("completed");
    expect(toolStatusOf(tool("output-error"), true)).toBe("failed");
  });
});

describe("activityOf", () => {
  it("thinks before the first token", () => {
    expect(activityOf(traceOf([], true), "submitted")).toEqual({
      kind: "thinking",
    });
  });

  it("names the lookup in flight and how many run beside it", () => {
    const trace = traceOf(
      [step, tool("input-available", "a"), tool("input-available", "b")],
      true
    );

    expect(activityOf(trace, "streaming")).toMatchObject({
      kind: "running",
      parallel: 2,
    });
  });

  it("draws while a chart fence is open, writes otherwise", () => {
    expect(
      activityOf(
        traceOf([step, text("Sure.\n```openui-lang\nroot")], true),
        "streaming"
      )
    ).toEqual({ kind: "drawing" });

    expect(
      activityOf(traceOf([step, text("Sure.")], true), "streaming")
    ).toEqual({ kind: "writing" });
  });

  it("is idle once the answer is complete", () => {
    expect(
      activityOf(traceOf([step, text("Sure.")], false), "ready")
    ).toBeNull();
  });
});
