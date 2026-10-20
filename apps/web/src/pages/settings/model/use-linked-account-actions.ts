import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

import { AUTH_ACCOUNTS_QUERY_KEY } from "../api/auth-queries";
import { linkedAccountErrorMessage } from "./security-error-messages";

export const useLinkedAccountActions = () => {
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const { origin } = window.location;
      const { error } = await authClient.linkSocial({
        callbackURL: `${origin}/settings?section=security`,
        errorCallbackURL: `${origin}/settings?section=security`,
        provider,
      });

      if (error) {
        throw new Error(linkedAccountErrorMessage(error));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await authClient.unlinkAccount({ accountId });

      if (error) {
        throw new Error(linkedAccountErrorMessage(error));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_ACCOUNTS_QUERY_KEY,
      });

      toast.success(m.settings_accounts_disconnected_toast());
    },
  });

  return {
    connect: connectMutation.mutate,
    connectingProvider: connectMutation.isPending
      ? connectMutation.variables
      : null,
    disconnect: disconnectMutation.mutate,
    disconnectingId: disconnectMutation.isPending
      ? disconnectMutation.variables
      : null,
  };
};
