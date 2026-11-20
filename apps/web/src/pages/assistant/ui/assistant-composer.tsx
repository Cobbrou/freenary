import { MAX_QUESTION_CHARS } from "@freenary/api/assistant/turn";
import { InputMessage } from "@freenary/ui/components/input-message";
import { useId } from "react";

import {
  AssistantModelSelector,
  browserLoadProgress,
  rememberModel,
} from "@/features/assistant-chat";
import type { AssistantModelState } from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

interface AssistantComposerProps {
  disabled: boolean;
  model: AssistantModelState | null;
  onActiveChange?: (active: boolean) => void;
  onSend: (question: string) => void;
  onStop?: () => void;
  onValueChange: (value: string) => void;
  placeholder: string;
  serverModel: string | null;
  streaming: boolean;
  suggestions?: string[];
  value: string;
}

const QUESTION_COUNTER_FROM_CHARS = MAX_QUESTION_CHARS * 0.9;

const QuestionLength = ({ chars, id }: { chars: number; id: string }) =>
  chars >= QUESTION_COUNTER_FROM_CHARS && (
    <span className="text-muted-foreground text-xs tabular-nums" id={id}>
      {m.assistant_question_length({
        count: chars.toLocaleString(getLocale()),
        max: MAX_QUESTION_CHARS.toLocaleString(getLocale()),
      })}
    </span>
  );

export const AssistantComposer = ({
  disabled,
  model,
  onActiveChange,
  onSend,
  onStop,
  onValueChange,
  placeholder,
  serverModel,
  streaming,
  suggestions,
  value,
}: AssistantComposerProps) => {
  const questionCounterId = useId();

  return (
    <InputMessage
      disabled={disabled}
      leftSlot={
        model && (
          <AssistantModelSelector
            disabled={streaming}
            loadingProgress={browserLoadProgress(model)}
            onSelect={rememberModel}
            selected={model.selected}
            serverModel={serverModel}
            webGpu={model.webGpu}
          />
        )
      }
      onSend={(text) => {
        if (!streaming) {
          onSend(text);
        }
      }}
      onStop={onStop}
      onValueChange={(next) => {
        onValueChange(next);
        onActiveChange?.(true);
      }}
      placeholder={placeholder}
      rightSlot={<QuestionLength chars={value.length} id={questionCounterId} />}
      sendLabel={m.assistant_send()}
      status={streaming ? "streaming" : "idle"}
      stopLabel={m.assistant_stop()}
      suggestions={suggestions}
      textareaProps={{
        "aria-describedby": questionCounterId,
        "aria-label": placeholder,
        maxLength: MAX_QUESTION_CHARS,
        onBlur: () => onActiveChange?.(value.length > 0),
        onFocus: () => onActiveChange?.(true),
      }}
      value={value}
    />
  );
};
