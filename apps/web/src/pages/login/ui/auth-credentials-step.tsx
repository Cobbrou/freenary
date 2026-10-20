import { Button } from "@freenary/ui/components/button";
import { Field, FieldGroup } from "@freenary/ui/components/field";
import { InputGroupButton } from "@freenary/ui/components/input-addons";
import { Spinner } from "@freenary/ui/components/spinner";
import { spring } from "@freenary/ui/lib/springs";
import { RiRefreshLine } from "@remixicon/react";
import { useForm } from "@tanstack/react-form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { emailField, passwordField } from "@/shared/auth";

import type { AuthCapabilities } from "../model/auth-capabilities";
import { useEmailAccountCheck } from "../model/use-email-account-check";
import type { AccountMode } from "../model/use-email-account-check";
import { AuthFormField } from "./auth-form-field";
import { AuthSignInOptions } from "./auth-sign-in-options";

interface AuthCredentialsStepProps {
  capabilities: AuthCapabilities | undefined;
  defaultEmail: string;
  isCapabilitiesError: boolean;
  isPasskeyPending: boolean;
  isSubmitting: boolean;
  onForgotPassword: (email: string) => void;
  onPasskey: () => void;
  onProvider: (provider: string) => void;
  onRetryCapabilities: () => void;
  onSignIn: (values: { email: string; password: string }) => Promise<void>;
  onSignUp: (values: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  pendingProvider: string | null;
}

const NAME_MIN_LENGTH = 2;

const reducedMotionTransition = {
  ...spring.moderate,
  height: { duration: 0 },
};

const FOCUS_RING_SAFE_CLIP_CLASS = "-mx-1 overflow-hidden px-1";
const REVEALED_GAP_AND_RING_ROOM_CLASS = "pt-4 pb-1";

const buildCredentialsSchemaForLocale = (
  mode: AccountMode,
  minPasswordLength: number | undefined
) => {
  const isRevealed = mode !== "unknown";
  const isSignUp = mode === "signup";
  const chosenPasswordMinLength = isSignUp ? minPasswordLength : undefined;

  return z.object({
    email: emailField(),
    name: isSignUp
      ? z.string().min(NAME_MIN_LENGTH, m.auth_error_name_too_short())
      : z.string(),
    password: isRevealed ? passwordField(chosenPasswordMinLength) : z.string(),
  });
};

export const AuthCredentialsStep = ({
  capabilities,
  defaultEmail,
  isCapabilitiesError,
  isPasskeyPending,
  isSubmitting,
  onForgotPassword,
  onPasskey,
  onProvider,
  onRetryCapabilities,
  onSignIn,
  onSignUp,
  pendingProvider,
}: AuthCredentialsStepProps) => {
  const {
    checkFailure,
    email,
    handleEmailChange,
    handleRetryCheck,
    isChecking,
    mode,
  } = useEmailAccountCheck(defaultEmail);

  const prefersReducedMotion = useReducedMotion();

  const schema = useMemo(
    () =>
      buildCredentialsSchemaForLocale(mode, capabilities?.minPasswordLength),
    [mode, capabilities?.minPasswordLength]
  );

  const form = useForm({
    defaultValues: { email: defaultEmail, name: "", password: "" },
    onSubmit: ({ value }) => {
      if (mode === "unknown") {
        return;
      }

      return mode === "signin"
        ? onSignIn({ email: value.email, password: value.password })
        : onSignUp(value);
    },
    validators: { onSubmit: schema },
  });

  const isSignUp = mode === "signup";
  const areCredentialsRevealed = mode !== "unknown";
  const isCheckBlocked = checkFailure !== null;
  const canResetPassword = !isSignUp && capabilities?.emailDelivery === true;

  const renderEmailCheckAdornment = () => {
    if (isChecking) {
      return <Spinner className="size-3.5" />;
    }

    if (!isCheckBlocked) {
      return null;
    }

    return (
      <InputGroupButton
        aria-label={m.auth_email_check_retry()}
        className="size-6"
        onClick={handleRetryCheck}
        size="icon-compact"
      >
        <RiRefreshLine aria-hidden="true" />
      </InputGroupButton>
    );
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => (
              <AuthFormField
                autoComplete="email"
                autoFocus
                endAdornment={renderEmailCheckAdornment()}
                errors={field.state.meta.errors.map((error) => error?.message)}
                id={field.name}
                label={m.auth_email_label()}
                placeholder={m.auth_email_placeholder()}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value);
                  handleEmailChange(value);
                }}
              />
            )}
          </form.Field>

          {isCheckBlocked && (
            <output className="text-muted-foreground text-sm">
              {checkFailure === "rate-limited"
                ? m.auth_email_check_blocked_rate_limited()
                : m.auth_email_check_blocked_unavailable()}
            </output>
          )}
        </FieldGroup>

        <AnimatePresence initial={false}>
          {areCredentialsRevealed && (
            <motion.div
              key="credentials"
              className={FOCUS_RING_SAFE_CLIP_CLASS}
              animate={{ height: "auto", opacity: 1 }}
              exit={{
                height: 0,
                opacity: 0,
                transition: prefersReducedMotion
                  ? reducedMotionTransition
                  : spring.moderate.exit,
              }}
              initial={{ height: 0, opacity: 0 }}
              transition={
                prefersReducedMotion ? reducedMotionTransition : spring.moderate
              }
            >
              <FieldGroup className={REVEALED_GAP_AND_RING_ROOM_CLASS}>
                {isSignUp && (
                  <form.Field name="name">
                    {(field) => (
                      <AuthFormField
                        autoComplete="name"
                        errors={field.state.meta.errors.map(
                          (error) => error?.message
                        )}
                        id={field.name}
                        label={m.auth_name_label()}
                        placeholder={m.auth_name_placeholder()}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                )}

                <form.Field name="password">
                  {(field) => (
                    <AuthFormField
                      autoComplete={
                        isSignUp ? "new-password" : "current-password"
                      }
                      errors={field.state.meta.errors.map(
                        (error) => error?.message
                      )}
                      id={field.name}
                      label={m.auth_password_label()}
                      placeholder={m.auth_password_placeholder()}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>

                <Field>
                  <Button loading={isSubmitting} type="submit">
                    {isSignUp
                      ? m.auth_sign_up_submit()
                      : m.auth_sign_in_submit()}
                  </Button>
                </Field>

                {canResetPassword && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onForgotPassword(email)}
                    >
                      {m.auth_forgot_password()}
                    </Button>
                  </div>
                )}
              </FieldGroup>
            </motion.div>
          )}
        </AnimatePresence>

        {areCredentialsRevealed && (
          <output className="sr-only">
            {isSignUp ? m.auth_reveal_sign_up() : m.auth_reveal_sign_in()}
          </output>
        )}
      </form>

      <AuthSignInOptions
        capabilities={capabilities}
        isError={isCapabilitiesError}
        isPasskeyPending={isPasskeyPending}
        onPasskey={onPasskey}
        onProvider={onProvider}
        onRetry={onRetryCapabilities}
        pendingProvider={pendingProvider}
      />
    </div>
  );
};
