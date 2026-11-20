import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { orpc } from "@/shared/api";

export const useStartChat = () => {
  const navigate = useNavigate();
  const { isPending, mutate } = useMutation(
    orpc.assistant.createConversation.mutationOptions()
  );

  const startChat = useCallback(
    (question: string) =>
      mutate(undefined, {
        onSuccess: ({ conversationId }) =>
          navigate({
            params: { conversationId },
            search: { q: question },
            to: "/ask/$conversationId",
          }),
      }),
    [mutate, navigate]
  );

  return { isStarting: isPending, startChat };
};
