import type { CategoryEntry } from "@freenary/api/lib/categories";
import { Button } from "@freenary/ui/components/button";
import { Separator } from "@freenary/ui/components/separator";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { Reorder } from "motion/react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";

import { categoryParentOptions } from "../model/category-parent-options";
import type { EditorLine } from "../model/use-budget-profile-editor";
import { BudgetLineRow } from "./budget-line-row";
import { BudgetProfilePreview } from "./budget-profile-preview";
import { CustomCategoryDialog } from "./custom-category-dialog";
import { SettingsSection } from "./settings-section";

interface BudgetingSectionProps {
  addLine: () => void;
  categories: CategoryEntry[];
  errors: Map<string, string>;
  isPending: boolean;
  lines: EditorLine[];
  moveLine: (id: string, direction: "down" | "up") => void;
  removeLine: (id: string) => void;
  reorderLines: (lines: EditorLine[]) => void;
  updateLine: (id: string, patch: Partial<EditorLine>) => void;
}

const SKELETON_LINES = 3;

export const BudgetingSection = ({
  addLine,
  categories,
  errors,
  isPending,
  lines,
  moveLine,
  removeLine,
  reorderLines,
  updateLine,
}: BudgetingSectionProps) => {
  const [lineIdAwaitingNewCategory, setLineIdAwaitingNewCategory] = useState<
    string | null
  >(null);

  const PlusIcon = useIcon("plus");
  const { control } = useSize();

  return (
    <SettingsSection
      description={m.settings_budgeting_description()}
      title={m.settings_budgeting_title()}
    >
      <BudgetProfilePreview
        categories={categories}
        isPending={isPending}
        lines={lines}
      />

      <Separator />

      {isPending ? (
        <div aria-busy="true">
          <output className="sr-only">{m.settings_budgeting_loading()}</output>
          <div aria-hidden="true" className="flex flex-col gap-2">
            {Array.from({ length: SKELETON_LINES }, (_, i) => (
              <Skeleton className={cn("w-full", control)} key={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lines.length > 0 ? (
            <Reorder.Group
              as="div"
              axis="y"
              className="flex flex-col gap-2"
              onReorder={reorderLines}
              values={lines}
            >
              {lines.map((line) => (
                <BudgetLineRow
                  categories={categories}
                  error={errors.get(line.id)}
                  key={line.id}
                  line={line}
                  onCreateCategory={setLineIdAwaitingNewCategory}
                  onMove={moveLine}
                  onRemove={removeLine}
                  onUpdate={updateLine}
                />
              ))}
            </Reorder.Group>
          ) : null}

          <Button
            className="self-start"
            leadingIcon={PlusIcon}
            onClick={addLine}
            variant="tertiary"
          >
            {m.settings_budgeting_add_line()}
          </Button>
        </div>
      )}

      <CustomCategoryDialog
        edited={null}
        onCreated={(key) => {
          if (lineIdAwaitingNewCategory) {
            updateLine(lineIdAwaitingNewCategory, { categoryKey: key });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setLineIdAwaitingNewCategory(null);
          }
        }}
        open={lineIdAwaitingNewCategory !== null}
        parentOptions={categoryParentOptions({
          categories,
          editedHasSubcategories: false,
          editedKey: null,
        })}
      />
    </SettingsSection>
  );
};
