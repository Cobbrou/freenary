import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { client } from "@/shared/api";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

export type AccountMode = "signin" | "signup" | "unknown";

type CheckFailure = "rate-limited" | "unavailable";

interface EmailCheck {
  email: string;
  mode: "signin" | "signup";
}

interface FailedCheck {
  email: string;
  reason: CheckFailure;
}

const EMAIL_CHECK_DELAY_MS = 500;

const isCompleteAddress = z.email();

export const useEmailAccountCheck = (initialEmail: string) => {
  const [email, setEmail] = useState(initialEmail);
  const [emailCheck, setEmailCheck] = useState<EmailCheck | null>(null);
  const [failedCheck, setFailedCheck] = useState<FailedCheck | null>(null);
  const latestAskedEmail = useRef("");

  const { isPending: isChecking, mutate: checkAccount } = useMutation({
    mutationFn: (value: string) => client.auth.accountExists({ email: value }),
    onError: (error, value) => {
      const isSuperseded = value !== latestAskedEmail.current;

      if (isSuperseded) {
        return;
      }

      const isRateLimited =
        error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS";

      setFailedCheck({
        email: value,
        reason: isRateLimited ? "rate-limited" : "unavailable",
      });

      toast.error(
        isRateLimited
          ? m.auth_error_rate_limited()
          : m.auth_email_check_failed()
      );
    },
    onSuccess: (checked, value) => {
      const isSuperseded = value !== latestAskedEmail.current;

      if (isSuperseded) {
        return;
      }

      setFailedCheck(null);
      setEmailCheck({
        email: value,
        mode: checked.exists ? "signin" : "signup",
      });
    },
  });

  const debouncedEmail = useDebouncedValue(email, EMAIL_CHECK_DELAY_MS);

  useEffect(() => {
    if (isCompleteAddress.safeParse(debouncedEmail).success) {
      latestAskedEmail.current = debouncedEmail;
      checkAccount(debouncedEmail);
    }
  }, [debouncedEmail, checkAccount]);

  const handleRetryCheck = () => {
    if (!isCompleteAddress.safeParse(email).success) {
      return;
    }

    setFailedCheck(null);
    latestAskedEmail.current = email;
    checkAccount(email);
  };

  const isCheckAboutCurrentEmail =
    emailCheck !== null && emailCheck.email === email;

  const mode: AccountMode = isCheckAboutCurrentEmail
    ? emailCheck.mode
    : "unknown";

  const isFailureAboutCurrentEmail =
    failedCheck !== null && failedCheck.email === email;

  const checkFailure: CheckFailure | null =
    isChecking || !isFailureAboutCurrentEmail ? null : failedCheck.reason;

  return {
    checkFailure,
    email,
    handleEmailChange: setEmail,
    handleRetryCheck,
    isChecking,
    mode,
  };
};
