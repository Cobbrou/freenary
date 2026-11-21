import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

import { AUTH_API_KEYS_QUERY_KEY } from "../api/auth-queries";
import { expiresInSecondsOf } from "./api-key-expiry";
import type { ApiKeyExpiryChoice } from "./api-key-expiry";
import { apiKeyErrorMessage } from "./security-error-messages";

export interface ApiKeyCreateInput {
  expiry: ApiKeyExpiryChoice;
  name: string;
}

export const useApiKeyActions = () => {
  const queryClient = useQueryClient();

  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: AUTH_API_KEYS_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: async ({
      expiry,
      name,
    }: ApiKeyCreateInput): Promise<string> => {
      const expiresIn = expiresInSecondsOf(expiry);
      const { data: created, error } = await authClient.apiKey.create(
        expiresIn === undefined ? { name } : { expiresIn, name }
      );

      if (error) {
        throw new Error(apiKeyErrorMessage(error));
      }

      return created.key;
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: async () => {
      await refreshList();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId });

      if (error) {
        throw new Error(apiKeyErrorMessage(error));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: async () => {
      await refreshList();

      toast.success(m.settings_api_keys_revoked_toast());
    },
  });

  return {
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    revoke: revokeMutation.mutate,
    revokingId: revokeMutation.isPending ? revokeMutation.variables : null,
  };
};
