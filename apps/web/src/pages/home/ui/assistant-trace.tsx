import { Button } from "@freenary/ui/components/button";
import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "@freenary/ui/components/thinking-steps";
import type { IconName } from "@freenary/ui/lib/icon-context";
import { RiContractUpDownLine, RiExpandUpDownLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import { formatDuration } from "../lib/format-duration";
import type { ExecutionStep, ExecutionTrace } from "../model/execution";
import { toolStatusOf } from "../model/execution";
import { useAutoFold } from "../model/use-auto-fold";
import {
  durationOf,
  spanOf,
  TURN_TIMING_KEY,
} from "../model/use-execution-timings";
import type { ExecutionTimings } from "../model/use-execution-timings";
import type { ExpandAll } from "../model/use-expand-all";
import { useExpandAll } from "../model/use-expand-all";
import { AssistantProse } from "./assistant-prose";
import { AssistantToolCall } from "./assistant-tool-call";

interface AssistantTraceProps {
  trace: ExecutionTrace;
  live: boolean;
  timings: ExecutionTimings;
  onRetry?: () => void;
}

const LOOKUPS_START_OPEN = true;

const stepLabel = (step: ExecutionStep, live: boolean): string => {
  if (step.tools.length > 0) {
    return m.assistant_step_lookups();
  }

  if (step.answer.length > 0) {
    if (live && step.status === "active") {
      return m.assistant_step_answer();
    }

    return step.answer.some((segment) => segment.kind === "chart")
      ? m.assistant_step_answer_chart()
      : m.assistant_step_answer_done();
  }

  return m.assistant_step_thinking();
};

const stepIcon = (step: ExecutionStep): IconName => {
  if (step.tools.length > 0) {
    return "search";
  }

  if (step.answer.some((segment) => segment.kind === "chart")) {
    return "image";
  }

  if (step.answer.length > 0) {
    return "pencil";
  }

  return "brain";
};

const thinkingSummary = (
  streaming: boolean,
  durationMs: number | undefined
): string => {
  if (streaming) {
    return m.assistant_thinking_streaming();
  }

  return durationMs === undefined
    ? m.assistant_thinking_done()
    : `${m.assistant_thinking_done()} ${formatDuration(durationMs)}`;
};

const Lookups = ({
  children,
  expanded,
  summary,
}: {
  children: ReactNode;
  expanded?: ExpandAll;
  summary: string;
}) => {
  const [open, setOpen] = useExpandAll(expanded, LOOKUPS_START_OPEN);

  return (
    <ThinkingStepDetails onOpenChange={setOpen} open={open} summary={summary}>
      {children}
    </ThinkingStepDetails>
  );
};

const Thought = ({
  children,
  live,
  summary,
}: {
  children: ReactNode;
  live: boolean;
  summary: string;
}) => {
  const [open, setOpen] = useAutoFold(live);

  return (
    <ThinkingStepDetails onOpenChange={setOpen} open={open} summary={summary}>
      {children}
    </ThinkingStepDetails>
  );
};

export const AssistantTrace = ({
  live,
  onRetry,
  timings,
  trace,
}: AssistantTraceProps) => {
  const [expanded, setExpanded] = useState<ExpandAll>();
  const [open, setOpen] = useAutoFold(live);
  const turn = durationOf(timings.get(TURN_TIMING_KEY));
  const lastIndex = trace.steps.length - 1;

  return (
    <ThinkingSteps
      className="w-full max-w-none"
      onOpenChange={setOpen}
      open={open}
    >
      <ThinkingStepsHeader>
        {live ? m.assistant_trace_title_live() : m.assistant_trace_title()}
        {turn !== undefined && (
          <span className="ml-2 font-mono text-xs tabular-nums">
            {formatDuration(turn)}
          </span>
        )}
      </ThinkingStepsHeader>
      <ThinkingStepsContent>
        {trace.lookups > 1 && (
          <div className="flex justify-end gap-1">
            <Button
              leadingIcon={remixIcon(RiExpandUpDownLine)}
              onClick={() => setExpanded({ tick: Date.now(), value: true })}
              size="compact"
              variant="ghost"
            >
              {m.assistant_trace_expand_all()}
            </Button>
            <Button
              leadingIcon={remixIcon(RiContractUpDownLine)}
              onClick={() => setExpanded({ tick: Date.now(), value: false })}
              size="compact"
              variant="ghost"
            >
              {m.assistant_trace_collapse_all()}
            </Button>
          </div>
        )}
        {trace.steps.map((step, position) => {
          const previousHadTools =
            (trace.steps[step.index - 1]?.tools.length ?? 0) > 0;

          const notes = [
            ...(step.tools.length > 1
              ? [m.assistant_step_parallel({ count: step.tools.length })]
              : []),
            ...(previousHadTools
              ? [m.assistant_step_after({ step: step.index })]
              : []),
          ];

          const streaming = step.thinking?.state === "streaming";
          const thinkingMs = step.thinking
            ? spanOf(timings, step.thinking.keys)
            : undefined;

          return (
            <ThinkingStep
              description={notes.length > 0 ? notes.join(" · ") : undefined}
              icon={stepIcon(step)}
              isLast={position === lastIndex && !trace.answerPending}
              key={step.index}
              label={stepLabel(step, live)}
              status={step.status}
            >
              {step.thinking && (
                <Thought
                  live={live}
                  summary={thinkingSummary(streaming, thinkingMs)}
                >
                  <AssistantProse>{step.thinking.text}</AssistantProse>
                </Thought>
              )}
              {step.tools.length > 0 && (
                <Lookups
                  expanded={expanded}
                  summary={m.assistant_trace_lookups({
                    count: step.tools.length,
                  })}
                >
                  {step.tools.map((tool) => (
                    <AssistantToolCall
                      durationMs={durationOf(timings.get(tool.toolCallId))}
                      expanded={expanded}
                      key={tool.toolCallId}
                      onRetry={onRetry}
                      part={tool}
                      status={toolStatusOf(tool, live)}
                    />
                  ))}
                </Lookups>
              )}
            </ThinkingStep>
          );
        })}
        {trace.answerPending && (
          <ThinkingStep
            icon="pencil"
            isLast
            label={m.assistant_step_answer_pending()}
            status="active"
          />
        )}
      </ThinkingStepsContent>
    </ThinkingSteps>
  );
};
