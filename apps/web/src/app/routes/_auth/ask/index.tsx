import { createFileRoute } from "@tanstack/react-router";

import { NewChatPage, newChatSearchSchema } from "@/pages/assistant";

export const Route = createFileRoute("/_auth/ask/")({
  component: NewChatPage,
  validateSearch: newChatSearchSchema,
});
