import { Button } from "@freenary/ui/components/button";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { RiRefreshLine } from "@remixicon/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AssistantModelStatus,
  assistantErrorMessage,
  useAssistantChat,
} from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import { assistantAvatarState } from "../model/avatar-state";
import { isToolPart } from "../model/execution";
import { livenessOf } from "../model/liveness";
import { AssistantActivity } from "./assistant-activity";
import { AssistantAvatar } from "./assistant-avatar";
import { AssistantComposer } from "./assistant-composer";
import { AssistantMessage } from "./assistant-message";
import { AssistantTranscript } from "./assistant-transcript";

interface AssistantChatProps {
  conversationId: string;
  initialMessages: UIMessage[];
  onPendingQuestionSent: () => void;
  pendingQuestion: string | undefined;
  serverModel: string | null;
}

interface TranscriptTailProps {
  avatarState: BrandAvatarState;
  error: Error | undefined;
  onRetry: () => void;
  retrying: boolean;
  awaitingFirstChunk: boolean;
}

const ACKNOWLEDGE_MS = 1600;

const TranscriptTail = ({
  avatarState,
  awaitingFirstChunk,
  error,
  onRetry,
  retrying,
}: TranscriptTailProps) => (
  <>
    {awaitingFirstChunk && (
      <div className="flex w-full gap-3">
        <AssistantAvatar className="mt-0.5 size-7" state={avatarState} />
        <AssistantActivity
          activity={{ kind: "thinking" }}
          retrying={retrying}
        />
      </div>
    )}
    {error && (
      <div
        className="text-destructive flex items-center gap-2 text-sm"
        role="alert"
      >
        <span>{assistantErrorMessage(error.message)}</span>
        <Button
          leadingIcon={remixIcon(RiRefreshLine)}
          onClick={onRetry}
          size="compact"
          variant="ghost"
        >
          {m.assistant_retry()}
        </Button>
      </div>
    )}
  </>
);

export const AssistantChat = ({
  conversationId,
  initialMessages,
  onPendingQuestionSent,
  pendingQuestion,
  serverModel,
}: AssistantChatProps) => {
  const [composerActive, setComposerActive] = useState(false);
  const [draft, setDraft] = useState("");
  const [justFinished, setJustFinished] = useState(false);
  const [turn, setTurn] = useState<{ retrying: boolean; startedAt: number }>();
  const acknowledgeTimer = useRef(0);
  const lastQuestion = useRef("");
  const pendingSent = useRef(false);

  const { chat, model } = useAssistantChat({
    conversationId,
    initialMessages,
    onError: () => setDraft((current) => current || lastQuestion.current),
    onFinish: ({ isAbort }) => {
      if (isAbort) {
        return;
      }

      setDraft((current) => (current === lastQuestion.current ? "" : current));
      setJustFinished(true);
      window.clearTimeout(acknowledgeTimer.current);
      acknowledgeTimer.current = window.setTimeout(
        () => setJustFinished(false),
        ACKNOWLEDGE_MS
      );
    },
    serverModel,
  });

  const { error, messages, regenerate, sendMessage, status, stop } = chat;

  useEffect(() => () => window.clearTimeout(acknowledgeTimer.current), []);

  const ask = useCallback(
    (text: string) => {
      lastQuestion.current = text;
      setTurn({ retrying: false, startedAt: Date.now() });
      sendMessage({ text });
    },
    [sendMessage]
  );

  useEffect(() => {
    if (
      pendingQuestion === undefined ||
      pendingSent.current ||
      !model.ready ||
      messages.length > 0
    ) {
      return;
    }

    pendingSent.current = true;
    ask(pendingQuestion);
    onPendingQuestionSent();
  }, [
    ask,
    messages.length,
    model.ready,
    onPendingQuestionSent,
    pendingQuestion,
  ]);

  const redo = useCallback(
    (messageId: string | null) => {
      setTurn({ retrying: true, startedAt: Date.now() });
      regenerate(messageId === null ? undefined : { messageId });
    },
    [regenerate]
  );

  const redoLastTurn = useCallback(() => redo(null), [redo]);

  const lastMessage = messages.at(-1);
  const toolRunning =
    lastMessage?.parts.some(
      (part) =>
        isToolPart(part) &&
        (part.state === "input-streaming" || part.state === "input-available")
    ) ?? false;

  const avatarState = assistantAvatarState({
    composerActive,
    hasError: error !== undefined,
    justFinished,
    status,
    toolRunning,
  });

  const { awaitingFirstChunk, liveMessageId, streamingMessageId } = livenessOf({
    attention: justFinished || composerActive || error !== undefined,
    messages,
    status,
  });

  const streaming = status === "streaming" || status === "submitted";
  const settled = status === "ready" && model.ready;
  const makeDashboard = useCallback(
    () => ask(m.ask_make_dashboard_prompt()),
    [ask]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AssistantTranscript scrollLabel={m.assistant_scroll_to_latest()}>
        {messages.map((message, index) => {
          const live = message.id === streamingMessageId;
          const isLastAnswer =
            message.role === "assistant" && index === messages.length - 1;

          return (
            <AssistantMessage
              avatarState={
                message.id === liveMessageId ? avatarState : undefined
              }
              key={message.id}
              latest={isLastAnswer}
              live={live}
              message={message}
              onMakeDashboard={settled ? makeDashboard : undefined}
              onRetry={isLastAnswer && settled ? redo : undefined}
              retrying={live && (turn?.retrying ?? false)}
              startedAt={live ? turn?.startedAt : undefined}
              status={live ? status : "ready"}
            />
          );
        })}
        <TranscriptTail
          avatarState={avatarState}
          awaitingFirstChunk={awaitingFirstChunk}
          error={error}
          onRetry={redoLastTurn}
          retrying={turn?.retrying ?? false}
        />
      </AssistantTranscript>
      <AssistantModelStatus
        browserModel={model.browserModel}
        selected={model.selected}
        webGpu={model.webGpu}
      />
      <AssistantComposer
        disabled={!model.ready}
        model={model}
        onActiveChange={setComposerActive}
        onSend={(text) => {
          ask(text);
          setDraft("");
          setComposerActive(false);
        }}
        onStop={stop}
        onValueChange={setDraft}
        placeholder={m.ask_follow_up_placeholder()}
        serverModel={serverModel}
        streaming={streaming}
        value={draft}
      />
    </div>
  );
};
