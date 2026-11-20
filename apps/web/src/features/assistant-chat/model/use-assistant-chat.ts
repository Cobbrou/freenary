import { useChat } from "@ai-sdk/react";
import { localDay } from "@freenary/api/assistant/prompt";
import { useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo } from "react";

import {
  publishDashboardUpdate,
  savedDashboardsOf,
} from "@/entities/dashboard";
import { getLocale } from "@/paraglide/runtime.js";
import { client, orpc } from "@/shared/api";
import { getServerUrl } from "@/shared/config";

import type { BrowserModelStatus } from "./browser/engine";
import {
  loadBrowserModel,
  useBrowserModel,
  useWebGpuSupport,
} from "./browser/engine";
import { createBrowserChatTransport } from "./browser/transport";
import {
  resolveModelChoice,
  SERVER_MODEL,
  useRememberedModel,
} from "./model-choice";

export interface AssistantChatOptions {
  conversationId: string | undefined;
  dashboardId?: string;
  initialMessages?: UIMessage[];
  onError?: () => void;
  onFinish?: (outcome: { isAbort: boolean; message: UIMessage }) => void;
  serverModel: string | null;
}

export interface AssistantModelState {
  browserModel: BrowserModelStatus;
  ready: boolean;
  selected: string | null;
  webGpu: boolean | null;
}

export const browserLoadProgress = ({
  browserModel,
  selected,
}: AssistantModelState): number | undefined =>
  browserModel.phase === "loading" && browserModel.modelId === selected
    ? browserModel.progress
    : undefined;

export const useAssistantModel = (
  serverModel: string | null
): AssistantModelState => {
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

  return { browserModel, ready, selected, webGpu };
};

export const useAssistantChat = ({
  conversationId,
  dashboardId,
  initialMessages,
  onError,
  onFinish,
  serverModel,
}: AssistantChatOptions) => {
  const queryClient = useQueryClient();
  const model = useAssistantModel(serverModel);
  const { selected } = model;

  const transport = useMemo(
    () =>
      selected === SERVER_MODEL
        ? new DefaultChatTransport({
            api: `${getServerUrl()}/ai/chat`,
            body: () => ({
              dashboardId,
              locale: getLocale(),
              today: localDay(new Date()),
            }),
            credentials: "include",
          })
        : createBrowserChatTransport({
            client,
            dashboardId,
            locale: getLocale,
          }),
    [dashboardId, selected]
  );

  const chat = useChat({
    id: conversationId,
    messages: initialMessages,
    onError,
    onFinish: ({ isAbort, message }) => {
      const saved = isAbort ? [] : savedDashboardsOf(message.parts);

      if (!isAbort) {
        void queryClient.invalidateQueries({ queryKey: orpc.assistant.key() });
      }

      if (saved.length > 0) {
        publishDashboardUpdate({
          dashboardIds: saved.map((dashboard) => dashboard.dashboardId),
          refresh: () =>
            queryClient.invalidateQueries({
              queryKey: orpc.dashboards.key(),
            }),
        });
      }

      onFinish?.({ isAbort, message });
    },
    transport,
  });

  return { chat, model };
};
