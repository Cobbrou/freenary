import { orpc } from "@/shared/api";

export const conversationsQueryOptions = () =>
  orpc.assistant.listConversations.queryOptions();

export const conversationQueryOptions = (conversationId: string) =>
  orpc.assistant.getConversation.queryOptions({ input: { conversationId } });
