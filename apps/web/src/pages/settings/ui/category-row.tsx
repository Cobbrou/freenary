import type { CategoryEntry } from "@freenary/api/lib/categories";
import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { RiArrowDownLine, RiArrowUpLine, RiPencilLine } from "@remixicon/react";
import { useRef } from "react";

import { categoryEntryLabel, CategoryIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";

import { DeleteCategoryDialog } from "./delete-category-dialog";

export interface CategoryRowActionsProps {
  budgetLineCount: number;
  className?: string;
  entry: CategoryEntry;
  fallbackLabel: string;
  isDeleting: boolean;
  isMoving: boolean;
  onDelete: (id: string) => void;
  onEdit: (entry: CategoryEntry) => void;
  onMove: (input: { direction: "down" | "up"; id: string }) => void;
  subcategoryCount: number;
}

interface CategoryRowProps {
  entry: CategoryEntry;
  fallbackLabel: string;
  index: number;
  isDeleting: boolean;
  isMoving: boolean;
  onDelete: (id: string) => void;
  onEdit: (entry: CategoryEntry) => void;
  onMove: (input: { direction: "down" | "up"; id: string }) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

export const CATEGORY_CHIP_BOX = {
  compact: "size-6 [&_svg]:size-3.5",
  default: "size-7 [&_svg]:size-4",
} as const;

export const ROW_ABOVE_HOVER_FILL = "relative z-10";

export const CATEGORY_COUNT_TEXT = "text-muted-foreground text-[11px]";

const BUILT_IN_ROW_NOT_INTERACTIVE = "text-muted-foreground";
const BUILT_IN_SWATCH_NOT_INTERACTIVE = "opacity-60";

const CUSTOM_CATEGORY_KEY_PREFIX = "custom:";

const bareCustomIdFromCategoryKey = (key: string): string =>
  key.startsWith(CUSTOM_CATEGORY_KEY_PREFIX)
    ? key.slice(CUSTOM_CATEGORY_KEY_PREFIX.length)
    : "";

export const CategoryRowActions = ({
  budgetLineCount,
  className,
  entry,
  fallbackLabel,
  isDeleting,
  isMoving,
  onDelete,
  onEdit,
  onMove,
  subcategoryCount,
}: CategoryRowActionsProps) => {
  const customId = bareCustomIdFromCategoryKey(entry.key);
  const label = categoryEntryLabel(entry);

  return (
    <ItemActions className={className}>
      <Button
        disabled={isMoving}
        onClick={() => onMove({ direction: "up", id: customId })}
        size="icon-compact"
        variant="ghost"
      >
        <RiArrowUpLine />
        <span className="sr-only">
          {m.settings_category_move_up({ label })}
        </span>
      </Button>
      <Button
        disabled={isMoving}
        onClick={() => onMove({ direction: "down", id: customId })}
        size="icon-compact"
        variant="ghost"
      >
        <RiArrowDownLine />
        <span className="sr-only">
          {m.settings_category_move_down({ label })}
        </span>
      </Button>
      <Button onClick={() => onEdit(entry)} size="icon-compact" variant="ghost">
        <RiPencilLine />
        <span className="sr-only">
          {m.settings_category_edit_action({ label })}
        </span>
      </Button>
      <DeleteCategoryDialog
        fallbackLabel={fallbackLabel}
        isDeleting={isDeleting}
        label={label}
        onConfirm={() => onDelete(customId)}
        subcategoryCount={subcategoryCount}
        usageCount={budgetLineCount}
      />
    </ItemActions>
  );
};

export const CategoryRow = ({
  entry,
  fallbackLabel,
  index,
  isDeleting,
  isMoving,
  onDelete,
  onEdit,
  onMove,
  registerItem,
}: CategoryRowProps) => {
  const isBuiltIn = !entry.isCustom;
  const label = categoryEntryLabel(entry);
  const rowRef = useRef<HTMLDivElement>(null);
  const { control, text, variant } = useSize();

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <Item
      className={cn(
        ROW_ABOVE_HOVER_FILL,
        "gap-2 border-0 px-3 py-0",
        control,
        isBuiltIn && BUILT_IN_ROW_NOT_INTERACTIVE
      )}
      ref={rowRef}
      render={<li />}
      size="sm"
    >
      <ItemMedia>
        <CategoryIcon
          className={cn(
            CATEGORY_CHIP_BOX[variant],
            isBuiltIn && BUILT_IN_SWATCH_NOT_INTERACTIVE
          )}
          color={entry.color}
          icon={entry.icon}
          slot={entry.slot}
        />
      </ItemMedia>

      <ItemContent className="min-w-0">
        <ItemTitle className={cn("block w-full truncate", text)}>
          {label}
        </ItemTitle>
      </ItemContent>

      {entry.usageCount > 0 ? (
        <span className={CATEGORY_COUNT_TEXT}>
          {m.settings_category_line_count({ count: entry.usageCount })}
        </span>
      ) : null}

      {isBuiltIn ? null : (
        <CategoryRowActions
          budgetLineCount={entry.usageCount}
          entry={entry}
          fallbackLabel={fallbackLabel}
          isDeleting={isDeleting}
          isMoving={isMoving}
          onDelete={onDelete}
          onEdit={onEdit}
          onMove={onMove}
          subcategoryCount={0}
        />
      )}
    </Item>
  );
};
