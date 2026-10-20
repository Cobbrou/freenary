import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Data, Effect } from "effect";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { client } from "@/shared/api";
import { authClient } from "@/shared/auth";
import { isWebAuthnAvailable } from "@/shared/lib/use-webauthn-support";

import type {
  AuthRequestError,
  PasswordBounds,
} from "../lib/auth-error-message";
import { authErrorMessage } from "../lib/auth-error-message";
import type { AuthOutcome } from "./use-auth-avatar";

export type SignInStep =
  | "confirm"
  | "credentials"
  | "reset"
  | "reset-request"
  | "two-factor";

export type SecondFactor = "app" | "recovery";

interface AuthAttempt<TData> {
  data: TData | null;
  error: AuthRequestError | null;
}

const NO_HTTP_STATUS = 0;

const DISMISSED_PASSKEY_CEREMONY_CODES = {
  ERROR_CEREMONY_ABORTED: true,
  ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY: true,
} satisfies Record<string, true>;

const SPENT_TWO_FACTOR_CHALLENGE_CODES = {
  INVALID_TWO_FACTOR_COOKIE: true,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: true,
} satisfies Record<string, true>;

const secondFactorOwedSchema = z.object({
  twoFactorRedirect: z.literal(true),
});

class AuthRequestUnreachable extends Data.TaggedError(
  "AuthRequestUnreachable"
)<{
  readonly cause: unknown;
}> {}

const attemptAuthRequest = <TData>(
  run: () => Promise<AuthAttempt<TData>>
): Promise<AuthAttempt<TData>> =>
  Effect.runPromise(
    Effect.tryPromise({
      catch: (cause) => new AuthRequestUnreachable({ cause }),
      try: () => run(),
    }).pipe(
      Effect.catchTag("AuthRequestUnreachable", () =>
        Effect.succeed<AuthAttempt<TData>>({
          data: null,
          error: { status: NO_HTTP_STATUS },
        })
      )
    )
  );

export const useSignInFlow = (passwordBounds: PasswordBounds | undefined) => {
  const navigate = useNavigate();
  const { refetch: refetchSession } = authClient.useSession();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<SignInStep>("credentials");
  const [secondFactor, setSecondFactor] = useState<SecondFactor>("app");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isPasskeyPending, setIsPasskeyPending] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AuthOutcome | null>(null);

  const settle = (kind: AuthOutcome["kind"]) => {
    setOutcome((previous) => ({ kind, seq: (previous?.seq ?? 0) + 1 }));
  };

  const refuse = (error: AuthRequestError) => {
    toast.error(authErrorMessage(error, passwordBounds));
    settle("error");
  };

  const finish = async (message: string) => {
    queryClient.clear();

    const viewer = await client.auth.viewer().catch(() => null);
    const wasSessionCookieDropped = viewer?.kind === "guest";

    if (wasSessionCookieDropped) {
      toast.error(m.auth_error_session_not_kept());
      settle("error");

      return;
    }

    settle("success");
    await refetchSession();
    await navigate({ to: "/" });
    toast.success(message);
  };

  const handleSignInSubmit = async (values: {
    email: string;
    password: string;
  }) => {
    setEmail(values.email);
    setIsSubmitting(true);
    const { data: signedIn, error } = await attemptAuthRequest(() =>
      authClient.signIn.email(values)
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      if (error.code === "EMAIL_NOT_VERIFIED") {
        setStep("confirm");
      }

      return;
    }

    if (secondFactorOwedSchema.safeParse(signedIn).success) {
      setSecondFactor("app");
      setStep("two-factor");

      return;
    }

    await finish(m.auth_signed_in_toast());
  };

  const handleSignUpSubmit = async (values: {
    email: string;
    name: string;
    password: string;
  }) => {
    setEmail(values.email);
    setIsSubmitting(true);
    const { data: signedUp, error } = await attemptAuthRequest(() =>
      authClient.signUp.email(values)
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      return;
    }

    const isSessionWithheldUntilConfirmed = (signedUp?.token ?? null) === null;

    if (isSessionWithheldUntilConfirmed) {
      toast.success(m.auth_signup_code_sent_toast());
      setStep("confirm");

      return;
    }

    await finish(m.auth_account_created_toast());
  };

  const handleConfirmSubmit = async (otp: string) => {
    setIsSubmitting(true);
    const { error } = await attemptAuthRequest(() =>
      authClient.emailOtp.verifyEmail({ email, otp })
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      return;
    }

    await finish(m.auth_verified_toast());
  };

  const handleResend = async () => {
    setIsResending(true);
    const { error } = await attemptAuthRequest(() =>
      step === "reset"
        ? authClient.emailOtp.requestPasswordReset({ email })
        : authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
          })
    );

    setIsResending(false);

    if (error) {
      refuse(error);

      return;
    }

    toast.success(m.auth_code_resent_toast());
  };

  const handleForgotPassword = (address: string) => {
    setEmail(address);
    setStep("reset-request");
  };

  const handleResetRequestSubmit = async (address: string) => {
    setEmail(address);
    setIsSubmitting(true);
    const { error } = await attemptAuthRequest(() =>
      authClient.emailOtp.requestPasswordReset({ email: address })
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      return;
    }

    setStep("reset");
  };

  const handleResetSubmit = async (values: {
    otp: string;
    password: string;
  }) => {
    setIsSubmitting(true);
    const { error } = await attemptAuthRequest(() =>
      authClient.emailOtp.resetPassword({
        email,
        otp: values.otp,
        password: values.password,
      })
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      return;
    }

    toast.success(m.auth_reset_success_toast());
    setStep("credentials");
  };

  const handleSecondFactorSubmit = async (values: {
    code: string;
    trustDevice: boolean;
  }) => {
    setIsSubmitting(true);
    const { error } = await attemptAuthRequest(() =>
      secondFactor === "recovery"
        ? authClient.twoFactor.verifyBackupCode(values)
        : authClient.twoFactor.verifyTotp(values)
    );

    setIsSubmitting(false);

    if (error) {
      refuse(error);

      const isChallengeSpent = Object.hasOwn(
        SPENT_TWO_FACTOR_CHALLENGE_CODES,
        error.code ?? ""
      );

      if (isChallengeSpent) {
        setStep("credentials");
      }

      return;
    }

    await finish(m.auth_signed_in_toast());
  };

  const handleSecondFactorSwitch = () => {
    setSecondFactor(secondFactor === "app" ? "recovery" : "app");
  };

  const handlePasskeySelect = async () => {
    if (!isWebAuthnAvailable()) {
      toast.error(m.auth_error_passkey_unsupported());
      settle("error");

      return;
    }

    setIsPasskeyPending(true);
    const { error } = await attemptAuthRequest(() =>
      authClient.signIn.passkey()
    );

    setIsPasskeyPending(false);

    if (error) {
      const wasCeremonyDismissed = Object.hasOwn(
        DISMISSED_PASSKEY_CEREMONY_CODES,
        error.code ?? ""
      );

      if (!wasCeremonyDismissed) {
        toast.error(m.auth_error_passkey_failed());
        settle("error");
      }

      return;
    }

    await finish(m.auth_signed_in_toast());
  };

  const handleProviderSelect = async (provider: string) => {
    setPendingProvider(provider);
    const { error } = await attemptAuthRequest(() =>
      authClient.signIn.social({
        callbackURL: `${window.location.origin}/`,
        errorCallbackURL: `${window.location.origin}/login`,
        provider,
      })
    );

    if (error) {
      setPendingProvider(null);
      refuse(error);
    }
  };

  return {
    email,
    goTo: setStep,
    handleConfirmSubmit,
    handleForgotPassword,
    handlePasskeySelect,
    handleProviderSelect,
    handleResend,
    handleResetRequestSubmit,
    handleResetSubmit,
    handleSecondFactorSubmit,
    handleSecondFactorSwitch,
    handleSignInSubmit,
    handleSignUpSubmit,
    isPasskeyPending,
    isResending,
    isSubmitting,
    outcome,
    pendingProvider,
    secondFactor,
    step,
  };
};
