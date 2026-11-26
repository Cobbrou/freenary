import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

export interface ProfileName {
  firstName: string;
  lastName: string;
}

export const useProfileName = () => {
  const { data: session, refetch } = authClient.useSession();

  const saveMutation = useMutation({
    mutationFn: async ({ firstName, lastName }: ProfileName) => {
      const { error } = await authClient.updateUser({
        lastName,
        name: firstName,
      });

      if (error) {
        throw new Error(m.settings_profile_save_error());
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: async () => {
      await refetch();
      toast.success(m.settings_profile_saved_toast());
    },
  });

  const user = session?.user;

  return {
    isSaving: saveMutation.isPending,
    name:
      user === undefined
        ? undefined
        : { firstName: user.name, lastName: user.lastName ?? "" },
    save: (name: ProfileName, onSaved: () => void) =>
      saveMutation.mutate(name, { onSuccess: onSaved }),
  };
};
