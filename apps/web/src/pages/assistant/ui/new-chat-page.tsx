import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { conversationsQueryOptions } from "@/entities/conversation";
import { dashboardsQueryOptions } from "@/entities/dashboard";
import {
  AssistantModelStatus,
  useAssistantModel,
  useStartChat,
} from "@/features/assistant-chat";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";
import { startOfDay, useNow } from "@/shared/lib/calendar-day";

import { AssistantAvatar } from "./assistant-avatar";
import { AssistantComposer } from "./assistant-composer";
import { ChatList } from "./chat-list";

const route = getRouteApi("/_auth/ask/");

export const NewChatPage = () => {
  const { draft: seededDraft } = route.useSearch();
  const [draft, setDraft] = useState(seededDraft ?? "");
  const [composerActive, setComposerActive] = useState(false);
  const now = useNow();
  const today = useMemo(() => startOfDay(now), [now]);
  const { data: session } = authClient.useSession();
  const status = useQuery(orpc.assistant.getStatus.queryOptions());
  const chats = useQuery(conversationsQueryOptions());
  const dashboards = useQuery(dashboardsQueryOptions());
  const { isStarting, startChat } = useStartChat();
  const serverModel = status.data?.serverModel ?? null;
  const model = useAssistantModel(serverModel);

  const suggestions = useMemo(
    () => [
      m.assistant_suggestion_spending(),
      m.assistant_suggestion_cash_flow(),
      m.assistant_suggestion_recurring(),
      m.ask_suggestion_dashboard(),
    ],
    []
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
        <AssistantAvatar
          className="size-14"
          label={m.assistant_avatar_label()}
          state={composerActive ? "listening" : "idle"}
        />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-balance">
            {m.ask_new_chat_title({
              name: session?.user.name.split(" ")[0] ?? "",
            })}
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">
            {m.ask_new_chat_description()}
          </p>
        </div>
      </div>
      <AssistantModelStatus
        browserModel={model.browserModel}
        deferred={model.deferred}
        selected={model.selected}
        webGpu={model.webGpu}
      />
      <AssistantComposer
        disabled={isStarting || model.selected === null}
        model={status.data === undefined ? null : model}
        onActiveChange={setComposerActive}
        onSend={startChat}
        onValueChange={setDraft}
        placeholder={m.ask_composer_placeholder()}
        serverModel={serverModel}
        streaming={isStarting}
        suggestions={suggestions}
        value={draft}
      />
      <div className="flex max-h-80 flex-col md:hidden">
        <ChatList
          chats={chats.data?.conversations}
          dashboards={dashboards.data?.dashboards}
          today={today}
        />
      </div>
    </div>
  );
};
