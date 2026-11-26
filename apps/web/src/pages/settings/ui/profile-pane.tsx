import { Button } from "@freenary/ui/components/button";
import { Field, FieldError, FieldLabel } from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";

import { useProfileName } from "../model/use-profile-name";
import type { ProfileName } from "../model/use-profile-name";
import { SettingsPane, SettingsSection } from "./settings-section";

const NAME_MAX_LENGTH = 100;

const profileNameSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: () => m.settings_profile_error_first_name_required() })
    .max(NAME_MAX_LENGTH),
  lastName: z
    .string()
    .trim()
    .min(1, { error: () => m.settings_profile_error_last_name_required() })
    .max(NAME_MAX_LENGTH),
});

interface ProfileNameFormProps {
  isSaving: boolean;
  name: ProfileName;
  onSave: (name: ProfileName, onSaved: () => void) => void;
}

const ProfileNameForm = ({ isSaving, name, onSave }: ProfileNameFormProps) => {
  const fieldId = useId();
  const form = useForm({
    defaultValues: name,
    onSubmit: ({ formApi, value }) => {
      const saved = {
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
      };

      onSave(saved, () => formApi.reset(saved));
    },
    validators: { onSubmit: profileNameSchema },
  });

  const fields = [
    {
      autoComplete: "given-name",
      label: m.settings_profile_first_name_label(),
      name: "firstName",
    },
    {
      autoComplete: "family-name",
      label: m.settings_profile_last_name_label(),
      name: "lastName",
    },
  ] as const;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="grid max-w-lg gap-4 sm:grid-cols-2">
        {fields.map(({ autoComplete, label, name: fieldName }) => (
          <form.Field key={fieldName} name={fieldName}>
            {(field) => {
              const inputId = `${fieldId}-${fieldName}`;
              const isInvalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
                  <Input
                    aria-invalid={isInvalid || undefined}
                    autoComplete={autoComplete}
                    id={inputId}
                    maxLength={NAME_MAX_LENGTH}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          </form.Field>
        ))}
      </div>

      <form.Subscribe selector={(state) => state.isDirty}>
        {(isDirty) => (
          <div>
            <Button disabled={!isDirty} loading={isSaving} type="submit">
              {m.settings_save()}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
};

export const ProfilePane = () => {
  const { isSaving, name, save } = useProfileName();

  return (
    <SettingsPane
      description={m.settings_tab_profile_description()}
      title={m.settings_tab_profile()}
    >
      <SettingsSection
        description={m.settings_profile_name_description()}
        title={m.settings_profile_name_title()}
      >
        {name === undefined ? (
          <Skeleton className="h-16 max-w-lg" />
        ) : (
          <ProfileNameForm isSaving={isSaving} name={name} onSave={save} />
        )}
      </SettingsSection>
    </SettingsPane>
  );
};
