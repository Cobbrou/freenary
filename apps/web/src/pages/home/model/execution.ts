import type { ToolUIPart, UIMessage } from "ai";

import { splitAnswer } from "./answer-segments";
import type { AnswerSegment } from "./answer-segments";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ToolStatus =
  | "preparing"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus = "complete" | "active" | "pending";

export interface ExecutionStep {
  index: number;
  thinking: {
    state: "streaming" | "done";
    keys: string[];
    text: string;
  } | null;
  tools: ToolUIPart[];
  answer: AnswerSegment[];
  status: StepStatus;
}

export interface ExecutionTrace {
  steps: ExecutionStep[];
  answerPending: boolean;
  lookups: number;
}

export type Activity =
  | { kind: "thinking" }
  | { kind: "preparing"; tool: ToolUIPart }
  | { kind: "running"; tool: ToolUIPart; parallel: number }
  | { kind: "writing" }
  | { kind: "drawing" }
  | null;

export const TOOL_PART_TYPE_PREFIX = "tool-";

const TOOL_STATUS_BY_STATE = {
  "approval-requested": (live: boolean) => (live ? "preparing" : "cancelled"),
  "approval-responded": (live: boolean) => (live ? "running" : "cancelled"),
  "input-available": (live: boolean) => (live ? "running" : "cancelled"),
  "input-streaming": (live: boolean) => (live ? "preparing" : "cancelled"),
  "output-available": () => "completed",
  "output-denied": () => "cancelled",
  "output-error": () => "failed",
} satisfies Record<ToolUIPart["state"], (live: boolean) => ToolStatus>;

export const isToolPart = (
  part: UIMessage["parts"][number]
): part is ToolUIPart => part.type.startsWith(TOOL_PART_TYPE_PREFIX);

export const reasoningTimingKey = (partIndex: number): string =>
  `reasoning-${partIndex}`;

export const toolStatusOf = (part: ToolUIPart, live: boolean): ToolStatus =>
  TOOL_STATUS_BY_STATE[part.state](live);

const newStep = (index: number): ExecutionStep => ({
  answer: [],
  index,
  status: "complete",
  thinking: null,
  tools: [],
});

export const traceOf = (
  parts: UIMessage["parts"],
  live: boolean
): ExecutionTrace => {
  const steps: ExecutionStep[] = [];
  let current: ExecutionStep | undefined;

  for (const [index, part] of parts.entries()) {
    if (part.type === "step-start") {
      current = newStep(steps.length);
      steps.push(current);

      continue;
    }

    if (!current) {
      current = newStep(0);
      steps.push(current);
    }

    if (part.type === "reasoning") {
      const before = current.thinking;
      current.thinking = {
        keys: [...(before?.keys ?? []), reasoningTimingKey(index)],
        state: live && part.state === "streaming" ? "streaming" : "done",
        text: before ? `${before.text}\n\n${part.text}` : part.text,
      };
    } else if (isToolPart(part)) {
      current.tools.push(part);
    } else if (part.type === "text") {
      current.answer.push(...splitAnswer(part.text));
    }
  }

  const last = steps.at(-1);

  if (last && live) {
    last.status = "active";
  }

  return {
    answerPending:
      live &&
      last !== undefined &&
      last.tools.length > 0 &&
      last.answer.length === 0,
    lookups: steps.reduce((sum, step) => sum + step.tools.length, 0),
    steps,
  };
};

export const activityOf = (
  trace: ExecutionTrace,
  status: ChatStatus
): Activity => {
  if (status === "submitted") {
    return { kind: "thinking" };
  }

  if (status !== "streaming") {
    return null;
  }

  const step = trace.steps.at(-1);

  if (!step) {
    return { kind: "thinking" };
  }

  const preparing = step.tools.find((tool) => tool.state === "input-streaming");

  if (preparing) {
    return { kind: "preparing", tool: preparing };
  }

  const running = step.tools.filter((tool) => tool.state === "input-available");
  const [first] = running;

  if (first) {
    return { kind: "running", parallel: running.length, tool: first };
  }

  if (
    step.answer.some((segment) => segment.kind === "chart" && !segment.closed)
  ) {
    return { kind: "drawing" };
  }

  if (step.answer.length > 0) {
    return { kind: "writing" };
  }

  return { kind: "thinking" };
};
