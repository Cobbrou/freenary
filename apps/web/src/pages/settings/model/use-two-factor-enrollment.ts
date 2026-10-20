import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { authClient } from "@/shared/auth";

import { AUTH_SESSIONS_QUERY_KEY } from "../api/auth-queries";
import { twoFactorErrorMessage } from "./security-error-messages";
import { securityPasswordSchema, totpCodeSchema } from "./security-schemas";

export type TwoFactorStage = "codes" | "confirm" | "password" | "scan";

export type TwoFactorPurpose = "enable" | "regenerate";

interface UseTwoFactorEnrollmentOptions {
  onEnabled: () => void;
  purpose: TwoFactorPurpose;
}

export const useTwoFactorEnrollment = ({
  onEnabled,
  purpose,
}: UseTwoFactorEnrollmentOptions) => {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<TwoFactorStage>("password");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const passwordForm = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value }) => {
      setPasswordError(null);

      if (purpose === "regenerate") {
        const { data: generated, error } =
          await authClient.twoFactor.generateBackupCodes({
            password: value.password,
          });

        if (error) {
          setPasswordError(twoFactorErrorMessage(error));

          return;
        }

        setBackupCodes(generated.backupCodes);
        setStage("codes");

        return;
      }

      const { data: enrolment, error } = await authClient.twoFactor.enable({
        method: "totp",
        password: value.password,
      });

      if (error) {
        setPasswordError(twoFactorErrorMessage(error));

        return;
      }

      const hasNothingToScan = enrolment.method !== "totp";

      if (hasNothingToScan) {
        setPasswordError(m.settings_2fa_error_generic());

        return;
      }

      setTotpUri(enrolment.totpURI);
      setBackupCodes(enrolment.backupCodes);
      setStage("scan");
    },
    validators: { onSubmit: securityPasswordSchema },
  });

  const codeForm = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      setCodeError(null);

      const { error } = await authClient.twoFactor.verifyTotp({
        code: value.code.trim(),
      });

      if (error) {
        setCodeError(twoFactorErrorMessage(error));

        return;
      }

      onEnabled();
      await queryClient.invalidateQueries({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
      });

      setStage("codes");
      toast.success(m.settings_2fa_enabled_toast());
    },
    validators: { onSubmit: totpCodeSchema },
  });

  const reset = useCallback(() => {
    setStage("password");
    setTotpUri("");
    setBackupCodes([]);
    setPasswordError(null);
    setCodeError(null);
    passwordForm.reset();
    codeForm.reset();
  }, [codeForm, passwordForm]);

  return {
    backupCodes,
    codeError,
    codeForm,
    passwordError,
    passwordForm,
    reset,
    showConfirmStage: () => setStage("confirm"),
    stage,
    totpUri,
  };
};
