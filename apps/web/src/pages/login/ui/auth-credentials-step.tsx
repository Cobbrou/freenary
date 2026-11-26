import { Button } from "@freenary/ui/components/button";
import { Field, FieldGroup } from "@freenary/ui/components/field";
import { spring } from "@freenary/ui/lib/springs";
import { useForm } from "@tanstack/react-form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { emailField, passwordField } from "@/shared/auth";

import type { AuthCapabilities } from "../model/auth-capabilities";
import type { SignUpValues } from "../model/use-sign-in-flow";
import { AuthFormField } from "./auth-form-field";
import { AuthSignInOptions } from "./auth-sign-in-options";

type AccountMode = "signin" | "signup";

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
  onSignUp: (values: SignUpValues) => Promise<void>;
  pendingProvider: string | null;
}

const REDUCED_REVEAL = {
  height: { duration: 0 },
  opacity: { duration: 0.15 },
} as const;

const INSTANT = { duration: 0 } as const;

const buildCredentialsSchemaForLocale = (
  mode: AccountMode,
  minPasswordLength: number | undefined
) => {
  const isSignUp = mode === "signup";

  return z.object({
    email: emailField(),
    firstName: isSignUp
      ? z.string().trim().min(1, m.auth_error_first_name_required())
      : z.string(),
    lastName: isSignUp
      ? z.string().trim().min(1, m.auth_error_last_name_required())
      : z.string(),
    password: passwordField(isSignUp ? minPasswordLength : undefined),
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
  const [mode, setMode] = useState<AccountMode>("signin");
  const prefersReducedMotion = useReducedMotion();

  const schema = useMemo(
    () =>
      buildCredentialsSchemaForLocale(mode, capabilities?.minPasswordLength),
    [mode, capabilities?.minPasswordLength]
  );

  const form = useForm({
    defaultValues: {
      email: defaultEmail,
      firstName: "",
      lastName: "",
      password: "",
    },
    onSubmit: ({ value }) =>
      mode === "signin"
        ? onSignIn({ email: value.email, password: value.password })
        : onSignUp({
            email: value.email,
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            password: value.password,
          }),
    validators: { onSubmit: schema },
  });

  const isSignUp = mode === "signup";
  const canResetPassword = !isSignUp && capabilities?.emailDelivery === true;

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
                errors={field.state.meta.errors.map((error) => error?.message)}
                id={field.name}
                label={m.auth_email_label()}
                placeholder={m.auth_email_placeholder()}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>

          <AnimatePresence initial={false}>
            {isSignUp && (
              <motion.div
                key="name"
                animate={{
                  height: "auto",
                  opacity: 1,
                  transitionEnd: { overflow: "visible" },
                }}
                className="-mt-4"
                exit={{
                  height: 0,
                  opacity: 0,
                  overflow: "hidden",
                  transition: prefersReducedMotion
                    ? INSTANT
                    : spring.moderate.exit,
                }}
                initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                transition={
                  prefersReducedMotion ? REDUCED_REVEAL : spring.moderate
                }
              >
                <div className="grid gap-4 pt-4 @sm/field-group:grid-cols-2">
                  <form.Field name="firstName">
                    {(field) => (
                      <AuthFormField
                        autoComplete="given-name"
                        autoFocus
                        errors={field.state.meta.errors.map(
                          (error) => error?.message
                        )}
                        id={field.name}
                        label={m.auth_first_name_label()}
                        placeholder={m.auth_first_name_placeholder()}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  <form.Field name="lastName">
                    {(field) => (
                      <AuthFormField
                        autoComplete="family-name"
                        errors={field.state.meta.errors.map(
                          (error) => error?.message
                        )}
                        id={field.name}
                        label={m.auth_last_name_label()}
                        placeholder={m.auth_last_name_placeholder()}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form.Field name="password">
            {(field) => (
              <AuthFormField
                autoComplete={isSignUp ? "new-password" : "current-password"}
                errors={field.state.meta.errors.map((error) => error?.message)}
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
              {isSignUp ? m.auth_sign_up_submit() : m.auth_sign_in_submit()}
            </Button>
          </Field>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(isSignUp ? "signin" : "signup")}
            >
              {isSignUp
                ? m.auth_switch_to_sign_in()
                : m.auth_switch_to_sign_up()}
            </Button>

            {canResetPassword && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onForgotPassword(form.getFieldValue("email"))}
              >
                {m.auth_forgot_password()}
              </Button>
            )}
          </div>
        </FieldGroup>

        <output className="sr-only">
          {isSignUp ? m.auth_sign_up_submit() : m.auth_sign_in_submit()}
        </output>
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
