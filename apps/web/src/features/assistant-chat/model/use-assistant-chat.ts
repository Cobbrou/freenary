import { useChat } from "@ai-sdk/react";
import { localDay } from "@freenary/api/assistant/prompt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo } from "react";

import {
  publishDashboardUpdate,
  savedDashboardsOf,
} from "@/entities/dashboard";
import { getLocale } from "@/paraglide/runtime.js";
import { client, orpc } from "@/shared/api";
import { getServerUrl } from "@/shared/config";

import type { BrowserModelStatus } from "./browser/engine";
import {
  BROWSER_MODELS_QUERY_KEY,
  browserModelCatalog,
  loadBrowserModel,
  useBrowserModel,
  useWebGpuSupport,
} from "./browser/engine";
import { defaultBrowserModel } from "./browser/models";
import { createBrowserChatTransport } from "./browser/transport";
import {
  rememberModel,
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
  commit: () => void;
  deferred: boolean;
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
  const remembered = useRememberedModel();
  const needsDeviceDefault =
    serverModel === null &&
    webGpu === true &&
    (remembered === null || remembered === SERVER_MODEL);

  const catalog = useQuery({
    enabled: needsDeviceDefault,
    queryFn: browserModelCatalog,
    queryKey: BROWSER_MODELS_QUERY_KEY,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const deviceDefault =
    needsDeviceDefault && catalog.data
      ? (defaultBrowserModel(catalog.data)?.id ?? null)
      : null;

  const selected = resolveModelChoice(remembered, serverModel, deviceDefault);
  const browserSelected = selected !== null && selected !== SERVER_MODEL;
  const deferred = browserSelected && selected !== remembered;

  useEffect(() => {
    const engineBusy = browserModel.phase === "loading";
    const selectedAlreadyAttempted =
      browserModel.phase !== "idle" && browserModel.modelId === selected;

    if (
      browserSelected &&
      !deferred &&
      webGpu === true &&
      !(engineBusy || selectedAlreadyAttempted)
    ) {
      loadBrowserModel(selected);
    }
  }, [browserModel, browserSelected, deferred, selected, webGpu]);

  const commit = useCallback(() => {
    if (deferred && selected !== null) {
      rememberModel(selected);
    }
  }, [deferred, selected]);

  const ready =
    selected === SERVER_MODEL ||
    (browserSelected &&
      browserModel.phase === "ready" &&
      browserModel.modelId === selected);

  return { browserModel, commit, deferred, ready, selected, webGpu };
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
