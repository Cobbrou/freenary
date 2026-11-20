import { Button } from "@freenary/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { useCallback } from "react";

import { conversationQueryOptions } from "@/entities/conversation";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { MissingItem } from "@/shared/ui/missing-item";

import { AssistantChat } from "./assistant-chat";
import { AssistantChatSkeleton } from "./assistant-chat-skeleton";

const route = getRouteApi("/_auth/ask/$conversationId");

export const ConversationPage = () => {
  const { conversationId } = route.useParams();
  const { q: pendingQuestion } = route.useSearch();
  const navigate = useNavigate();
  const conversation = useQuery(conversationQueryOptions(conversationId));
  const status = useQuery(orpc.assistant.getStatus.queryOptions());

  const clearPendingQuestion = useCallback(
    () =>
      navigate({
        params: { conversationId },
        replace: true,
        search: {},
        to: "/ask/$conversationId",
      }),
    [conversationId, navigate]
  );

  if (conversation.isError) {
    return (
      <MissingItem
        action={
          <Button render={<Link to="/ask" />} variant="secondary">
            {m.ask_new_chat()}
          </Button>
        }
        description={m.ask_chat_missing_description()}
        title={m.ask_chat_missing_title()}
      />
    );
  }

  if (conversation.data === undefined || status.data === undefined) {
    return <AssistantChatSkeleton />;
  }

  /* SAFETY: `parts` is the JSON the assistant's own stream wrote, so the stored
     shape is `UIMessage["parts"]` by construction; the API cannot type a JSON
     column more precisely than that. */
  const initialMessages = conversation.data.messages as UIMessage[];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <h1 className="sr-only">
        {conversation.data.title ?? m.ask_untitled_chat()}
      </h1>
      <AssistantChat
        conversationId={conversationId}
        initialMessages={initialMessages}
        key={conversationId}
        onPendingQuestionSent={clearPendingQuestion}
        pendingQuestion={pendingQuestion}
        serverModel={status.data.serverModel}
      />
    </div>
  );
};
