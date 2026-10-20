import { useChat } from "@ai-sdk/react";
import { Button } from "@freenary/ui/components/button";
import { InputMessage } from "@freenary/ui/components/input-message";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { RiAddLine, RiRefreshLine } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { client, orpc } from "@/shared/api";
import { getServerUrl } from "@/shared/config";
import { remixIcon } from "@/shared/lib/remix-icon";

import { assistantAvatarState } from "../model/avatar-state";
import type { BrowserModelStatus } from "../model/browser/engine";
import {
  loadBrowserModel,
  useBrowserModel,
  useWebGpuSupport,
} from "../model/browser/engine";
import { createBrowserChatTransport } from "../model/browser/transport";
import { isToolPart } from "../model/execution";
import { livenessOf } from "../model/liveness";
import {
  rememberModel,
  resolveModelChoice,
  SERVER_MODEL,
  useRememberedModel,
} from "../model/model-choice";
import { AssistantActivity } from "./assistant-activity";
import { AssistantAvatar } from "./assistant-avatar";
import { AssistantChatSkeleton } from "./assistant-chat-skeleton";
import { AssistantEmptyState } from "./assistant-empty-state";
import { AssistantMessage } from "./assistant-message";
import { AssistantModelSelector } from "./assistant-model-selector";
import { AssistantModelStatus } from "./assistant-model-status";
import { AssistantTranscript } from "./assistant-transcript";

interface AssistantChatProps {
  conversationId: string | undefined;
  initialMessages: UIMessage[] | undefined;
  isPending: boolean;
  serverModel: string | null;
  userName: string;
}

interface TranscriptTailProps {
  avatarState: BrandAvatarState;
  error: Error | undefined;
  onRetry: () => void;
  retrying: boolean;
  awaitingFirstChunk: boolean;
}

const ACKNOWLEDGE_MS = 1600;

const loadProgressOf = (
  engine: BrowserModelStatus,
  modelId: string | null
): number | undefined =>
  engine.phase === "loading" && engine.modelId === modelId
    ? engine.progress
    : undefined;

const errorMessageOf = (message: string): string => {
  if (message.includes("rate_limited")) {
    return m.assistant_error_rate_limited();
  }

  if (message.includes("unconfigured")) {
    return m.assistant_unavailable_description();
  }

  if (message.includes("browser_model_context")) {
    return m.assistant_error_browser_context();
  }

  if (message.includes("browser_model")) {
    return m.assistant_error_browser_model();
  }

  return m.assistant_error_generic();
};

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
        <span>{errorMessageOf(error.message)}</span>
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
  isPending,
  serverModel,
  userName,
}: AssistantChatProps) => {
  const queryClient = useQueryClient();
  const [composerActive, setComposerActive] = useState(false);
  const [draft, setDraft] = useState("");
  const [justFinished, setJustFinished] = useState(false);
  const [turn, setTurn] = useState<{ retrying: boolean; startedAt: number }>();
  const acknowledgeTimer = useRef(0);
  const webGpu = useWebGpuSupport();
  const browserModel = useBrowserModel();
  const selected = resolveModelChoice(useRememberedModel(), serverModel);
  const browserSelected = selected !== null && selected !== SERVER_MODEL;

  useEffect(() => {
    const engineBusy = browserModel.phase === "loading";
    const selectedAlreadyAttempted =
      browserModel.phase !== "idle" && browserModel.modelId === selected;

    if (
      browserSelected &&
      webGpu === true &&
      !(engineBusy || selectedAlreadyAttempted)
    ) {
      loadBrowserModel(selected);
    }
  }, [browserModel, browserSelected, selected, webGpu]);

  const ready =
    selected === SERVER_MODEL ||
    (browserSelected &&
      browserModel.phase === "ready" &&
      browserModel.modelId === selected);

  const transport = useMemo(
    () =>
      selected === SERVER_MODEL
        ? new DefaultChatTransport({
            api: `${getServerUrl()}/ai/chat`,
            body: { locale: getLocale() },
            credentials: "include",
          })
        : createBrowserChatTransport({ client, locale: getLocale }),
    [selected]
  );

  const refreshStoredConversation = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: orpc.assistant.getConversation.key(),
      }),
    [queryClient]
  );

  const { error, messages, regenerate, sendMessage, status, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    onFinish: ({ isAbort }) => {
      if (isAbort) {
        return;
      }

      refreshStoredConversation();

      setJustFinished(true);
      window.clearTimeout(acknowledgeTimer.current);
      acknowledgeTimer.current = window.setTimeout(
        () => setJustFinished(false),
        ACKNOWLEDGE_MS
      );
    },
    transport,
  });

  useEffect(() => () => window.clearTimeout(acknowledgeTimer.current), []);

  const newConversation = useMutation(
    orpc.assistant.startNewConversation.mutationOptions({
      onSuccess: refreshStoredConversation,
    })
  );

  const lastMessage = messages.at(-1);
  const toolRunning =
    lastMessage?.parts.some(
      (part) =>
        isToolPart(part) &&
        (part.state === "input-streaming" || part.state === "input-available")
    ) ?? false;

  const ask = useCallback(
    (text: string) => {
      setTurn({ retrying: false, startedAt: Date.now() });
      sendMessage({ text });
    },
    [sendMessage]
  );

  const redo = useCallback(
    (messageId: string | null) => {
      setTurn({ retrying: true, startedAt: Date.now() });
      regenerate(messageId === null ? undefined : { messageId });
    },
    [regenerate]
  );

  const redoLastTurn = useCallback(() => redo(null), [redo]);

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
  const conversationKnown = conversationId !== undefined;

  const suggestions = useMemo(
    () => [
      m.assistant_suggestion_spending(),
      m.assistant_suggestion_cash_flow(),
      m.assistant_suggestion_recurring(),
    ],
    []
  );

  return (
    <div className="flex h-[calc(100svh-4rem)] min-h-0 flex-col gap-4 p-4">
      {isPending ? (
        <AssistantChatSkeleton />
      ) : (
        <AssistantTranscript scrollLabel={m.assistant_scroll_to_latest()}>
          {messages.length === 0 ? (
            <AssistantEmptyState
              avatarState={avatarState}
              userName={userName}
            />
          ) : (
            messages.map((message, index) => {
              const live = message.id === streamingMessageId;
              const isLastAnswer =
                message.role === "assistant" && index === messages.length - 1;

              const retryable = isLastAnswer && status === "ready" && ready;

              return (
                <AssistantMessage
                  avatarState={
                    message.id === liveMessageId ? avatarState : undefined
                  }
                  key={message.id}
                  live={live}
                  message={message}
                  onRetry={retryable ? redo : undefined}
                  retrying={live && (turn?.retrying ?? false)}
                  startedAt={live ? turn?.startedAt : undefined}
                  status={live ? status : "ready"}
                />
              );
            })
          )}
          <TranscriptTail
            avatarState={avatarState}
            awaitingFirstChunk={awaitingFirstChunk}
            error={error}
            onRetry={redoLastTurn}
            retrying={turn?.retrying ?? false}
          />
        </AssistantTranscript>
      )}
      {!isPending && (
        <AssistantModelStatus
          browserModel={browserModel}
          selected={selected}
          webGpu={webGpu}
        />
      )}
      <InputMessage
        disabled={!(conversationKnown && ready)}
        leftSlot={
          <>
            {!isPending && (
              <AssistantModelSelector
                disabled={streaming}
                loadingProgress={loadProgressOf(browserModel, selected)}
                onSelect={rememberModel}
                selected={selected}
                serverModel={serverModel}
                webGpu={webGpu}
              />
            )}
            <Button
              disabled={newConversation.isPending}
              leadingIcon={remixIcon(RiAddLine)}
              onClick={() => newConversation.mutate({})}
              size="compact"
              variant="ghost"
            >
              {m.assistant_new_conversation()}
            </Button>
          </>
        }
        onSend={(text) => {
          if (streaming) {
            return;
          }

          ask(text);
          setDraft("");
          setComposerActive(false);
        }}
        onStop={stop}
        onValueChange={(next) => {
          setDraft(next);
          setComposerActive(true);
        }}
        placeholder={m.assistant_composer_placeholder()}
        sendLabel={m.assistant_send()}
        stopLabel={m.assistant_stop()}
        suggestions={messages.length === 0 && ready ? suggestions : undefined}
        status={streaming ? "streaming" : "idle"}
        textareaProps={{
          "aria-label": m.assistant_composer_placeholder(),
          onBlur: () => setComposerActive(draft.length > 0),
          onFocus: () => setComposerActive(true),
        }}
        value={draft}
      />
    </div>
  );
};
