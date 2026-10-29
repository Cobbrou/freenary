import { Button } from "@freenary/ui/components/button";
import { Field, FieldGroup } from "@freenary/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { emailField, passwordField } from "@/shared/auth";

import type { AuthCapabilities } from "../model/auth-capabilities";
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
  onSignUp: (values: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  pendingProvider: string | null;
}

const NAME_MIN_LENGTH = 2;

const buildCredentialsSchemaForLocale = (
  mode: AccountMode,
  minPasswordLength: number | undefined
) => {
  const isSignUp = mode === "signup";

  return z.object({
    email: emailField(),
    name: isSignUp
      ? z.string().min(NAME_MIN_LENGTH, m.auth_error_name_too_short())
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

  const schema = useMemo(
    () =>
      buildCredentialsSchemaForLocale(mode, capabilities?.minPasswordLength),
    [mode, capabilities?.minPasswordLength]
  );

  const form = useForm({
    defaultValues: { email: defaultEmail, name: "", password: "" },
    onSubmit: ({ value }) =>
      mode === "signin"
        ? onSignIn({ email: value.email, password: value.password })
        : onSignUp(value),
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

          {isSignUp && (
            <form.Field name="name">
              {(field) => (
                <AuthFormField
                  autoComplete="name"
                  autoFocus
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
