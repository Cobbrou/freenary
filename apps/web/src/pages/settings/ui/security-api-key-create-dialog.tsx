import { Button } from "@freenary/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@freenary/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { useForm } from "@tanstack/react-form";
import { Data, Effect } from "effect";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";

import {
  API_KEY_EXPIRY_CHOICES,
  DEFAULT_API_KEY_EXPIRY,
  isApiKeyExpiryChoice,
} from "../model/api-key-expiry";
import type { ApiKeyExpiryChoice } from "../model/api-key-expiry";
import type { ApiKeyCreateInput } from "../model/use-api-key-actions";

interface SecurityApiKeyCreateDialogProps {
  isCreating: boolean;
  onCreate: (
    input: ApiKeyCreateInput,
    callbacks: { onSuccess: (key: string) => void }
  ) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const API_KEY_NAME_MAX_LENGTH = 32;

const EXPIRY_LABELS = {
  "1y": m.settings_api_keys_expiry_1y,
  "30d": m.settings_api_keys_expiry_30d,
  "90d": m.settings_api_keys_expiry_90d,
  never: m.settings_api_keys_expiry_never,
} satisfies Record<ApiKeyExpiryChoice, () => string>;

const apiKeySchema = z.object({
  expiry: z.enum(API_KEY_EXPIRY_CHOICES),
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.settings_api_keys_error_name_required() })
    .max(API_KEY_NAME_MAX_LENGTH, {
      error: () =>
        m.settings_api_keys_error_name_too_long({
          max: API_KEY_NAME_MAX_LENGTH,
        }),
    }),
});

const EMPTY_FORM: ApiKeyCreateInput = {
  expiry: DEFAULT_API_KEY_EXPIRY,
  name: "",
};

class ClipboardWriteRefused extends Data.TaggedError("ClipboardWriteRefused")<{
  readonly cause: unknown;
}> {}

const copyApiKey = (key: string) =>
  Effect.tryPromise({
    catch: (cause) => new ClipboardWriteRefused({ cause }),
    try: () => navigator.clipboard.writeText(key),
  }).pipe(
    Effect.andThen(
      Effect.sync(() => {
        toast.success(m.settings_api_keys_copied());
      })
    ),
    Effect.catchTag("ClipboardWriteRefused", () =>
      Effect.sync(() => {
        toast.error(m.settings_api_keys_copy_error());
      })
    )
  );

export const SecurityApiKeyCreateDialog = ({
  isCreating,
  onCreate,
  onOpenChange,
  open,
}: SecurityApiKeyCreateDialogProps) => {
  const nameId = useId();
  const expiryId = useId();
  const CopyIcon = useIcon("copy");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const form = useForm({
    defaultValues: EMPTY_FORM,
    onSubmit: ({ value }) => {
      onCreate(
        { expiry: value.expiry, name: value.name.trim() },
        { onSuccess: setRevealedKey }
      );
    },
    validators: { onSubmit: apiKeySchema },
  });

  useEffect(() => {
    if (open) {
      form.reset(EMPTY_FORM);
    }
  }, [form, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRevealedKey(null);
    }

    onOpenChange(next);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {revealedKey === null
              ? m.settings_api_keys_create_title()
              : m.settings_api_keys_reveal_title()}
          </DialogTitle>
          <DialogDescription>
            {revealedKey === null
              ? m.settings_api_keys_create_description()
              : m.settings_api_keys_reveal_description()}
          </DialogDescription>
        </DialogHeader>

        {revealedKey === null ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <FieldLabel htmlFor={nameId}>
                      {m.settings_api_keys_name_label()}
                    </FieldLabel>
                    <Input
                      aria-invalid={field.state.meta.errors.length > 0}
                      autoComplete="off"
                      id={nameId}
                      maxLength={API_KEY_NAME_MAX_LENGTH}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder={m.settings_api_keys_name_placeholder()}
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="expiry">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={expiryId}>
                      {m.settings_api_keys_expiry_label()}
                    </FieldLabel>
                    <Select
                      onValueChange={(next: string) => {
                        if (isApiKeyExpiryChoice(next)) {
                          field.handleChange(next);
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger id={expiryId} />
                      <SelectContent>
                        <SelectGroup>
                          {API_KEY_EXPIRY_CHOICES.map((choice, position) => (
                            <SelectItem
                              index={position}
                              key={choice}
                              value={choice}
                            >
                              {EXPIRY_LABELS[choice]()}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <Field className="justify-end" orientation="horizontal">
                <Button
                  onClick={() => handleOpenChange(false)}
                  type="button"
                  variant="ghost"
                >
                  {m.settings_cancel()}
                </Button>
                <Button loading={isCreating} type="submit">
                  {m.settings_api_keys_create_confirm()}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="ring-border flex items-center gap-2 rounded-lg py-1.5 ps-3 pe-1.5 ring-1">
              <code
                aria-label={m.settings_api_keys_reveal_label()}
                className="min-w-0 flex-1 font-mono text-sm break-all select-all"
              >
                {revealedKey}
              </code>
              <Button
                leadingIcon={CopyIcon}
                onClick={() => {
                  void Effect.runPromise(copyApiKey(revealedKey));
                }}
                size="compact"
                type="button"
                variant="tertiary"
              >
                {m.settings_api_keys_copy()}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)} type="button">
                {m.settings_api_keys_reveal_done()}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
