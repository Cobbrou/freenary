import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

import { AUTH_SESSIONS_QUERY_KEY } from "../api/auth-queries";
import { twoFactorErrorMessage } from "./security-error-messages";
import { securityPasswordSchema } from "./security-schemas";

interface UseTwoFactorDisableOptions {
  onDisabled: () => void;
  onDone: () => void;
}

export const useTwoFactorDisable = ({
  onDisabled,
  onDone,
}: UseTwoFactorDisableOptions) => {
  const queryClient = useQueryClient();
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value }) => {
      setPasswordError(null);

      const { error } = await authClient.twoFactor.disable({
        password: value.password,
      });

      if (error) {
        setPasswordError(twoFactorErrorMessage(error));

        return;
      }

      onDisabled();
      await queryClient.invalidateQueries({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
      });

      onDone();
      toast.success(m.settings_2fa_disabled_toast());
    },
    validators: { onSubmit: securityPasswordSchema },
  });

  const reset = useCallback(() => {
    setPasswordError(null);
    form.reset();
  }, [form]);

  return { form, passwordError, reset };
};
