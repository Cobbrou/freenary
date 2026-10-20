import {
  MAX_AMOUNT_MINOR_UNITS,
  MAX_BUDGET_LINE_LABEL_LENGTH,
} from "@freenary/api/lib/budget-profile";
import type { CategoryEntry } from "@freenary/api/lib/categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";

import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";

export interface EditorLine {
  amountInput: string;
  categoryKey: string;
  id: string;
  label: string;
}

export interface ServerBudgetLine {
  amount: number;
  categoryKey: string;
  id: string;
  label: string | null;
}

export interface BudgetProfileEditor {
  addLine: () => void;
  changeCount: number;
  errors: Map<string, string>;
  isDirty: boolean;
  isSaving: boolean;
  lines: EditorLine[];
  moveLine: (id: string, direction: "down" | "up") => void;
  removeLine: (id: string) => void;
  reorderLines: (lines: EditorLine[]) => void;
  reset: () => void;
  save: () => void;
  updateLine: (id: string, patch: Partial<EditorLine>) => void;
}

const MINOR_UNITS_PER_MAJOR = 100;
const NO_CATEGORY_CHOSEN = "";
const A_PURE_REORDER_IS_ONE_CHANGE = 1;

const lineSchema = z.object({
  amount: z
    .number({ error: () => m.settings_line_error_amount() })
    .int({ error: () => m.settings_line_error_amount() })
    .min(0, { error: () => m.settings_line_error_amount() })
    .max(MAX_AMOUNT_MINOR_UNITS, {
      error: () => m.settings_line_error_amount_too_large(),
    }),
  categoryKey: z.string().min(1, { error: () => m.settings_category_pick() }),
  label: z
    .string()
    .trim()
    .max(MAX_BUDGET_LINE_LABEL_LENGTH, {
      error: () =>
        m.settings_error_name_too_long({ max: MAX_BUDGET_LINE_LABEL_LENGTH }),
    }),
});

export const amountOf = (amountInput: string): number => {
  const trimmed = amountInput.trim();

  if (trimmed === "") {
    return Number.NaN;
  }

  const major = Number(trimmed.replace(",", "."));

  return Number.isFinite(major)
    ? Math.round(major * MINOR_UNITS_PER_MAJOR)
    : Number.NaN;
};

const toPayload = (line: EditorLine) => ({
  amount: amountOf(line.amountInput),
  categoryKey: line.categoryKey,
  label: line.label.trim(),
});

const toEditorLines = (serverLines: ServerBudgetLine[]): EditorLine[] =>
  serverLines.map((line) => ({
    amountInput: (line.amount / MINOR_UNITS_PER_MAJOR).toString(),
    categoryKey: line.categoryKey,
    id: line.id,
    label: line.label ?? "",
  }));

const signatureOf = (serverLines: ServerBudgetLine[] | undefined) =>
  JSON.stringify(serverLines ?? []);

export const useBudgetProfileEditor = (
  serverLines: ServerBudgetLine[] | undefined,
  categories: CategoryEntry[]
): BudgetProfileEditor => {
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const draftEditCount = useRef(0);
  const [lines, setLines] = useState<EditorLine[]>(() =>
    toEditorLines(serverLines ?? [])
  );

  const [hydratedSignature, setHydratedSignature] = useState(() =>
    signatureOf(serverLines)
  );

  const signature = signatureOf(serverLines);
  const shouldFollowServer = !isDirty && signature !== hydratedSignature;

  if (shouldFollowServer) {
    setHydratedSignature(signature);
    setLines(toEditorLines(serverLines ?? []));
  }

  useUnsavedChangesWarning(isDirty);

  const errors = useMemo(() => {
    const knownKeys = new Set(categories.map((entry) => entry.key));
    const found = new Map<string, string>();

    for (const line of lines) {
      const parsed = lineSchema.safeParse(toPayload(line));
      const isCategoryStillAvailable = knownKeys.has(line.categoryKey);
      const message = isCategoryStillAvailable
        ? parsed.error?.issues[0]?.message
        : m.settings_category_pick();

      if (message) {
        found.set(line.id, message);
      }
    }

    return found;
  }, [categories, lines]);

  const changeCount = useMemo(() => {
    const original = toEditorLines(serverLines ?? []);
    const originalById = new Map(original.map((line) => [line.id, line]));
    let count = 0;
    const seen = new Set<string>();

    for (const line of lines) {
      seen.add(line.id);
      const prev = originalById.get(line.id);

      if (!prev) {
        count += 1;
      } else if (
        prev.label !== line.label ||
        prev.amountInput !== line.amountInput ||
        prev.categoryKey !== line.categoryKey
      ) {
        count += 1;
      }
    }

    for (const id of originalById.keys()) {
      if (!seen.has(id)) {
        count += 1;
      }
    }

    const isReordered = original.some(
      (line, index) => lines[index]?.id !== line.id
    );

    return count === 0 && isReordered ? A_PURE_REORDER_IS_ONE_CHANGE : count;
  }, [lines, serverLines]);

  const saveMutation = useMutation({
    mutationFn: (submitted: EditorLine[]) =>
      client.settings.saveBudgetProfile({ lines: submitted.map(toPayload) }),
    onError: (error: Error) => {
      toast.error(error.message || m.settings_budgeting_save_error());
    },
    onMutate: () => ({ draftEditCount: draftEditCount.current }),
    onSuccess: async (_saved, _submitted, context) => {
      const wasDraftUntouchedWhileSaving =
        draftEditCount.current === context.draftEditCount;

      if (wasDraftUntouchedWhileSaving) {
        setIsDirty(false);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.settings.getBudgetProfile.queryOptions().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.settings.listCategories.queryOptions().queryKey,
        }),
      ]);

      toast.success(m.settings_budgeting_save_success());
    },
  });

  const addLine = useCallback(() => {
    draftEditCount.current += 1;
    setIsDirty(true);
    setLines((current) => [
      ...current,
      {
        amountInput: "",
        categoryKey: NO_CATEGORY_CHOSEN,
        id: crypto.randomUUID(),
        label: "",
      },
    ]);
  }, []);

  const removeLine = useCallback((id: string) => {
    draftEditCount.current += 1;
    setIsDirty(true);
    setLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<EditorLine>) => {
    draftEditCount.current += 1;
    setIsDirty(true);
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }, []);

  const reorderLines = useCallback((next: EditorLine[]) => {
    draftEditCount.current += 1;
    setIsDirty(true);
    setLines(next);
  }, []);

  const moveLine = useCallback(
    (id: string, direction: "down" | "up") => {
      const from = lines.findIndex((line) => line.id === id);
      const to = direction === "up" ? from - 1 : from + 1;

      if (from === -1 || to < 0 || to >= lines.length) {
        return;
      }

      const next = [...lines];
      const [moved] = next.splice(from, 1);

      if (!moved) {
        return;
      }

      next.splice(to, 0, moved);
      reorderLines(next);
    },
    [lines, reorderLines]
  );

  const reset = useCallback(() => {
    draftEditCount.current = 0;
    setIsDirty(false);
    setLines(toEditorLines(serverLines ?? []));
  }, [serverLines]);

  const save = useCallback(() => {
    saveMutation.mutate(lines);
  }, [lines, saveMutation]);

  return {
    addLine,
    changeCount,
    errors,
    isDirty,
    isSaving: saveMutation.isPending,
    lines,
    moveLine,
    removeLine,
    reorderLines,
    reset,
    save,
    updateLine,
  };
};
