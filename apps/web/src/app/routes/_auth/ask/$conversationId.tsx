import { createFileRoute } from "@tanstack/react-router";

import { ConversationPage, conversationSearchSchema } from "@/pages/assistant";

export const Route = createFileRoute("/_auth/ask/$conversationId")({
  component: ConversationPage,
  validateSearch: conversationSearchSchema,
});
