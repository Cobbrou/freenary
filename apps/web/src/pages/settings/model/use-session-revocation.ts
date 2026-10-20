import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

import { AUTH_SESSIONS_QUERY_KEY } from "../api/auth-queries";

export const useSessionRevocation = () => {
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });

      if (error) {
        throw new Error(error.message ?? m.settings_sessions_revoke_error());
      }
    },
    onError: () => {
      toast.error(m.settings_sessions_revoke_error());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
      });

      toast.success(m.settings_sessions_revoked_toast());
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();

      if (error) {
        throw new Error(
          error.message ?? m.settings_sessions_revoke_others_error()
        );
      }
    },
    onError: () => {
      toast.error(m.settings_sessions_revoke_others_error());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
      });

      toast.success(m.settings_sessions_revoke_others_toast());
    },
  });

  return {
    isRevokingOthers: revokeOthersMutation.isPending,
    revokeOtherSessions: revokeOthersMutation.mutate,
    revokeSession: revokeMutation.mutate,
    revokingToken: revokeMutation.isPending ? revokeMutation.variables : null,
  };
};
