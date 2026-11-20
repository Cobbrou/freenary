import { useMutation } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAssistantChat } from "@/features/assistant-chat";
import { orpc } from "@/shared/api";

interface DashboardChangeOptions {
  conversationId: string | null;
  dashboardId: string;
  serverModel: string | null;
}

const CODE_FENCE = /```[\s\S]*?(?:```|$)/gu;

export const replyText = (message: UIMessage | undefined): string =>
  message?.role === "assistant"
    ? message.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n")
        .replace(CODE_FENCE, "")
        .trim()
    : "";

export const useDashboardChange = ({
  conversationId,
  dashboardId,
  serverModel,
}: DashboardChangeOptions) => {
  const [chatId, setChatId] = useState(conversationId);
  const [pending, setPending] = useState<string | null>(null);
  const sentFor = useRef<string | null>(null);

  const createConversation = useMutation(
    orpc.assistant.createConversation.mutationOptions()
  );

  const { chat, model } = useAssistantChat({
    conversationId: chatId ?? undefined,
    dashboardId,
    serverModel,
  });

  const { sendMessage } = chat;

  useEffect(() => {
    if (
      pending === null ||
      chatId === null ||
      !model.ready ||
      sentFor.current === pending
    ) {
      return;
    }

    sentFor.current = pending;
    setPending(null);
    sendMessage({ text: pending });
  }, [chatId, model.ready, pending, sendMessage]);

  const requestChange = useCallback(
    (instruction: string) => {
      sentFor.current = null;
      setPending(instruction);

      if (chatId === null) {
        createConversation.mutate(undefined, {
          onSuccess: ({ conversationId: created }) => setChatId(created),
        });
      }
    },
    [chatId, createConversation]
  );

  const working =
    pending !== null ||
    createConversation.isPending ||
    chat.status === "submitted" ||
    chat.status === "streaming";

  return {
    chatId,
    error: chat.error ?? createConversation.error ?? null,
    model,
    reply: chat.status === "ready" ? replyText(chat.messages.at(-1)) : "",
    requestChange,
    stop: chat.stop,
    working,
  };
};
