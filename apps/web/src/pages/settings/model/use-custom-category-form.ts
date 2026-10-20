import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_NAMES,
} from "@freenary/api/lib/taxonomy";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

export type CustomCategoryValues = z.infer<typeof categorySchema>;

export interface EditedCustomCategory extends CustomCategoryValues {
  id: string;
}

interface UseCustomCategoryFormOptions {
  edited: EditedCustomCategory | null;
  onCreated?: (key: string) => void;
  onDone: () => void;
}

const MAX_LABEL_LENGTH = 40;

const categorySchema = z.object({
  color: z.enum(CATEGORY_COLOR_VALUES),
  icon: z.enum(CATEGORY_ICON_NAMES),
  label: z
    .string()
    .trim()
    .min(1, { error: () => m.settings_error_name_required() })
    .max(MAX_LABEL_LENGTH, {
      error: () => m.settings_error_name_too_long({ max: MAX_LABEL_LENGTH }),
    }),
  parentKey: z.string().nullable(),
});

const DEFAULT_VALUES: CustomCategoryValues = {
  color: "blue",
  icon: "DotsThreeIcon",
  label: "",
  parentKey: null,
};

export const useCustomCategoryForm = ({
  edited,
  onCreated,
  onDone,
}: UseCustomCategoryFormOptions) => {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (values: CustomCategoryValues) => {
      if (edited) {
        await client.settings.updateCustomCategory({
          ...values,
          id: edited.id,
        });

        return null;
      }

      const { key } = await client.settings.createCustomCategory(values);

      return key;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.settings.listCategories.queryOptions().queryKey,
      });

      toast.success(
        edited
          ? m.settings_category_update_success()
          : m.settings_category_create_success()
      );

      if (key) {
        onCreated?.(key);
      }

      onDone();
    },
  });

  const form = useForm({
    defaultValues: edited
      ? {
          color: edited.color,
          icon: edited.icon,
          label: edited.label,
          parentKey: edited.parentKey,
        }
      : DEFAULT_VALUES,
    onSubmit: ({ value }) => {
      saveMutation.mutate(value);
    },
    validators: { onSubmit: categorySchema },
  });

  return { form, isSaving: saveMutation.isPending };
};
