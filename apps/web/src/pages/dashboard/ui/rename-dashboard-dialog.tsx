import { DASHBOARD_TITLE_CHARS } from "@freenary/api/dashboards/widgets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@freenary/ui/components/alert-dialog";
import { Field, FieldError, FieldLabel } from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useEffect, useId } from "react";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";

interface RenameDashboardDialogProps {
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => void;
  open: boolean;
  title: string;
}

const titleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: () => m.dashboard_rename_required() })
    .max(DASHBOARD_TITLE_CHARS, {
      error: () => m.dashboard_rename_too_long({ max: DASHBOARD_TITLE_CHARS }),
    }),
});

export const RenameDashboardDialog = ({
  onOpenChange,
  onRename,
  open,
  title,
}: RenameDashboardDialogProps) => {
  const fieldId = useId();
  const form = useForm({
    defaultValues: { title },
    onSubmit: ({ value }) => {
      onRename(value.title.trim());
      onOpenChange(false);
    },
    validators: { onSubmit: titleSchema },
  });

  useEffect(() => {
    if (open) {
      form.reset({ title });
    }
  }, [form, open, title]);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{m.dashboard_rename_title()}</AlertDialogTitle>
          </AlertDialogHeader>
          <form.Field name="title">
            {(field) => (
              <Field
                className="py-4"
                data-invalid={field.state.meta.errors.length > 0}
              >
                <FieldLabel htmlFor={fieldId}>
                  {m.dashboard_rename_label()}
                </FieldLabel>
                <Input
                  aria-invalid={field.state.meta.errors.length > 0}
                  autoComplete="off"
                  id={fieldId}
                  maxLength={DASHBOARD_TITLE_CHARS}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
            <AlertDialogAction type="submit">
              {m.dashboard_rename_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
