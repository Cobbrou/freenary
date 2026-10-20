import { customCategoryKey } from "@freenary/api/lib/categories";
import type { CategoryEntry } from "@freenary/api/lib/categories";
import {
  CATEGORY_GROUP_FALLBACKS,
  isCategoryGroup,
} from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@freenary/ui/components/collapsible";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import { Skeleton } from "@freenary/ui/components/skeleton";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { useShape } from "@freenary/ui/lib/shape-context";
import { SizeProvider, useSize } from "@freenary/ui/lib/size-context";
import type { SizeVariant } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { useMemo, useRef, useState } from "react";
import type { TransitionEvent } from "react";

import {
  categoryEntryLabel,
  CategoryIcon,
  categoryLabel,
} from "@/entities/category";
import { m } from "@/paraglide/messages.js";

import { categoryParentOptions } from "../model/category-parent-options";
import { editedOf } from "../model/category-sections";
import { useCustomCategoryActions } from "../model/use-custom-category-actions";
import type { EditedCustomCategory } from "../model/use-custom-category-form";
import {
  CATEGORY_CHIP_BOX,
  CATEGORY_COUNT_TEXT,
  CategoryRow,
  CategoryRowActions,
  ROW_ABOVE_HOVER_FILL,
} from "./category-row";
import { CustomCategoryDialog } from "./custom-category-dialog";
import { SETTINGS_BLEED, SettingsSection } from "./settings-section";

type CategoryEditorState = EditedCustomCategory | "new" | null;

interface CategoryTreeGroup {
  children: CategoryEntry[];
  group: CategoryEntry;
}

interface CategoriesSectionProps {
  categories: CategoryEntry[];
  isPending: boolean;
}

interface CategoryGroupHeaderProps {
  group: CategoryEntry;
  index: number;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

interface CustomCategoryParentRowProps {
  entry: CategoryEntry;
  fallbackLabel: string;
  index: number;
  isDeleting: boolean;
  isMoving: boolean;
  onDelete: (id: string) => void;
  onEdit: (entry: CategoryEntry) => void;
  onMove: (input: { direction: "down" | "up"; id: string }) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
  subcategories: CategoryEntry[];
}

const SKELETON_GROUPS = 3;

const LIST_SIZE: SizeVariant = "default";

const CHILDREN_UNDER_THE_PARENT_ICON =
  "border-border ml-[45px] gap-0.5 border-l pl-2";

const ACTIONS_OVER_THE_DISCLOSURE_ROW =
  "absolute inset-y-0 right-3 z-20 flex items-center gap-2";

const DISCLOSURE_GUTTER_UNDER_THE_ACTIONS = "pr-39";

const catchAllCategoryLabelOf = (groupKey: string) =>
  isCategoryGroup(groupKey)
    ? categoryLabel(CATEGORY_GROUP_FALLBACKS[groupKey])
    : categoryLabel("uncategorised");

const toGroupTreeInServerOrder = (
  categories: CategoryEntry[]
): CategoryTreeGroup[] => {
  const tree: CategoryTreeGroup[] = [];

  for (const entry of categories) {
    if (entry.isGroup) {
      tree.push({ children: [], group: entry });
    } else {
      tree.at(-1)?.children.push(entry);
    }
  }

  return tree;
};

const CategoryGroupHeader = ({
  group,
  index,
  registerItem,
}: CategoryGroupHeaderProps) => {
  const headerRef = useRef<HTMLButtonElement>(null);
  const { control, text, variant } = useSize();

  useRegisterFluidHoverItem(registerItem, index, headerRef);

  return (
    <CollapsibleTrigger
      chevron="leading"
      className={cn("relative z-10 px-3", control)}
      ref={headerRef}
    >
      <CategoryIcon
        className={CATEGORY_CHIP_BOX[variant]}
        color={group.color}
        icon={group.icon}
      />
      <span className={cn("flex-1 truncate font-medium", text)}>
        {categoryEntryLabel(group)}
      </span>
    </CollapsibleTrigger>
  );
};

const CustomCategoryParentRow = ({
  entry,
  fallbackLabel,
  index,
  isDeleting,
  isMoving,
  onDelete,
  onEdit,
  onMove,
  registerItem,
  subcategories,
}: CustomCategoryParentRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const { control, text, variant } = useSize();
  const budgetLineCount = subcategories.reduce(
    (total, subcategory) => total + subcategory.usageCount,
    entry.usageCount
  );

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <div className={cn(ROW_ABOVE_HOVER_FILL, control)} ref={rowRef}>
      <CollapsibleTrigger
        chevron="leading"
        className={cn("h-full pl-3", DISCLOSURE_GUTTER_UNDER_THE_ACTIONS)}
      >
        <CategoryIcon
          className={CATEGORY_CHIP_BOX[variant]}
          color={entry.color}
          icon={entry.icon}
        />
        <span className={cn("flex-1 truncate font-medium", text)}>
          {categoryEntryLabel(entry)}
        </span>
        {entry.usageCount > 0 ? (
          <span className={CATEGORY_COUNT_TEXT}>
            {m.settings_category_line_count({ count: entry.usageCount })}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CategoryRowActions
        budgetLineCount={budgetLineCount}
        className={ACTIONS_OVER_THE_DISCLOSURE_ROW}
        entry={entry}
        fallbackLabel={fallbackLabel}
        isDeleting={isDeleting}
        isMoving={isMoving}
        onDelete={onDelete}
        onEdit={onEdit}
        onMove={onMove}
        subcategoryCount={subcategories.length}
      />
    </div>
  );
};

export const CategoriesSection = ({
  categories,
  isPending,
}: CategoriesSectionProps) => {
  const { deleteCategory, isDeleting, isMoving, moveCategory } =
    useCustomCategoryActions();

  const [categoryEditor, setCategoryEditor] =
    useState<CategoryEditorState>(null);

  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const PlusIcon = useIcon("plus");
  const shape = useShape();
  const { control } = useSize(LIST_SIZE);
  const hover = useFluidHover(listRef, { axis: "y", gapClick: false });

  const remeasureAfterTheHeightSettles = (
    event: TransitionEvent<HTMLElement>
  ) => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === "height"
    ) {
      hover.remeasure();
    }
  };

  const tree = useMemo(
    () => toGroupTreeInServerOrder(categories),
    [categories]
  );

  const { hoverIndices, rowsThatLightUp } = useMemo(() => {
    const indices = new Map<string, number>();
    const lit = new Set<number>();
    let next = 0;

    for (const { children, group } of tree) {
      indices.set(group.key, next);
      lit.add(next);
      next += 1;

      for (const child of children) {
        indices.set(child.key, next);

        if (child.isCustom) {
          lit.add(next);
        }

        next += 1;
      }
    }

    return { hoverIndices: indices, rowsThatLightUp: lit };
  }, [tree]);

  const parentOptions = useMemo(() => {
    const editedKey =
      categoryEditor === null || categoryEditor === "new"
        ? null
        : customCategoryKey(categoryEditor.id);

    return categoryParentOptions({
      categories,
      editedHasSubcategories: tree.some(
        ({ children, group }) => group.key === editedKey && children.length > 0
      ),
      editedKey,
    });
  }, [categories, categoryEditor, tree]);

  return (
    <SettingsSection
      action={
        <Button
          disabled={isPending}
          leadingIcon={PlusIcon}
          onClick={() => setCategoryEditor("new")}
          variant="tertiary"
        >
          {m.settings_category_new()}
        </Button>
      }
      description={m.settings_categories_description()}
      title={m.settings_categories_title()}
    >
      {isPending ? (
        <div aria-busy="true">
          <output className="sr-only">{m.settings_categories_loading()}</output>
          <div
            aria-hidden="true"
            className={cn("flex flex-col", SETTINGS_BLEED)}
          >
            {Array.from({ length: SKELETON_GROUPS }, (_, i) => (
              <div className={cn("flex items-center px-3", control)} key={i}>
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SizeProvider size={LIST_SIZE}>
          <div
            className={cn("relative flex flex-col", SETTINGS_BLEED)}
            ref={listRef}
            {...hover.handlers}
          >
            <FluidHoverHighlight
              className={shape.bg}
              hidden={
                hover.activeIndex === null ||
                !rowsThatLightUp.has(hover.activeIndex)
              }
              hover={hover}
            />
            <ul className="flex flex-col">
              {tree.map(({ children, group }) => {
                const fallbackLabel = catchAllCategoryLabelOf(group.key);
                const isUsersOwnCategoryWithoutSubcategories =
                  group.isCustom && children.length === 0;

                if (isUsersOwnCategoryWithoutSubcategories) {
                  return (
                    <CategoryRow
                      entry={group}
                      fallbackLabel={fallbackLabel}
                      index={hoverIndices.get(group.key) ?? 0}
                      isDeleting={isDeleting}
                      isMoving={isMoving}
                      key={group.key}
                      onDelete={deleteCategory}
                      onEdit={(edited) => setCategoryEditor(editedOf(edited))}
                      onMove={moveCategory}
                      registerItem={hover.registerItem}
                    />
                  );
                }

                return (
                  <Collapsible
                    key={group.key}
                    onOpenChange={(open) =>
                      setOpenGroups((current) =>
                        open
                          ? [...current, group.key]
                          : current.filter((key) => key !== group.key)
                      )
                    }
                    open={openGroups.includes(group.key)}
                    render={<li />}
                  >
                    {group.isCustom ? (
                      <CustomCategoryParentRow
                        entry={group}
                        fallbackLabel={fallbackLabel}
                        index={hoverIndices.get(group.key) ?? 0}
                        isDeleting={isDeleting}
                        isMoving={isMoving}
                        onDelete={deleteCategory}
                        onEdit={(edited) => setCategoryEditor(editedOf(edited))}
                        onMove={moveCategory}
                        registerItem={hover.registerItem}
                        subcategories={children}
                      />
                    ) : (
                      <CategoryGroupHeader
                        group={group}
                        index={hoverIndices.get(group.key) ?? 0}
                        registerItem={hover.registerItem}
                      />
                    )}
                    <CollapsibleContent
                      onTransitionEnd={remeasureAfterTheHeightSettles}
                    >
                      <ul
                        className={cn(
                          "flex flex-col",
                          CHILDREN_UNDER_THE_PARENT_ICON
                        )}
                      >
                        {children.map((entry) => (
                          <CategoryRow
                            entry={entry}
                            fallbackLabel={fallbackLabel}
                            index={hoverIndices.get(entry.key) ?? 0}
                            isDeleting={isDeleting}
                            isMoving={isMoving}
                            key={entry.key}
                            onDelete={deleteCategory}
                            onEdit={(edited) =>
                              setCategoryEditor(editedOf(edited))
                            }
                            onMove={moveCategory}
                            registerItem={hover.registerItem}
                          />
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </ul>
          </div>
        </SizeProvider>
      )}

      <CustomCategoryDialog
        edited={categoryEditor === "new" ? null : categoryEditor}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryEditor(null);
          }
        }}
        open={categoryEditor !== null}
        parentOptions={parentOptions}
      />
    </SettingsSection>
  );
};
