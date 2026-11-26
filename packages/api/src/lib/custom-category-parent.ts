import { parseCategoryKey } from "./categories";
import { isCategoryGroup, isCountedGroup } from "./taxonomy";
import type { CategoryGroup } from "./taxonomy";

export type ResolvedCustomCategoryParent =
  | { parentId: null; parentSlug: CategoryGroup }
  | { parentId: string; parentSlug: null }
  | { parentId: null; parentSlug: null };

export type CustomCategoryParentRefusal =
  | "not-a-category"
  | "parent-is-itself"
  | "parent-is-nested"
  | "parent-not-found"
  | "would-nest-a-parent";

export type CustomCategoryParentOutcome =
  | { parent: ResolvedCustomCategoryParent }
  | { refusal: CustomCategoryParentRefusal };

export interface CustomCategoryParentRow {
  id: string;
  parentId: string | null;
  parentSlug: string | null;
}

export const isCustomCategoryParentRefused = (
  outcome: CustomCategoryParentOutcome
): outcome is { refusal: CustomCategoryParentRefusal } =>
  Object.hasOwn(outcome, "refusal");

const isTopLevel = (row: CustomCategoryParentRow): boolean =>
  row.parentId === null && row.parentSlug === null;

export const resolveCustomCategoryParent = (input: {
  categoryId: string | null;
  owned: CustomCategoryParentRow[];
  parentKey: string | null;
}): CustomCategoryParentOutcome => {
  if (input.parentKey === null) {
    return { parent: { parentId: null, parentSlug: null } };
  }

  const holdsSubcategories =
    input.categoryId !== null &&
    input.owned.some((row) => row.parentId === input.categoryId);

  if (holdsSubcategories) {
    return { refusal: "would-nest-a-parent" };
  }

  if (isCategoryGroup(input.parentKey)) {
    return isCountedGroup(input.parentKey)
      ? { parent: { parentId: null, parentSlug: input.parentKey } }
      : { refusal: "not-a-category" };
  }

  const customId = parseCategoryKey(input.parentKey)?.customId ?? null;

  if (customId === null) {
    return { refusal: "not-a-category" };
  }

  if (customId === input.categoryId) {
    return { refusal: "parent-is-itself" };
  }

  const parent = input.owned.find((row) => row.id === customId);

  if (!parent) {
    return { refusal: "parent-not-found" };
  }

  return isTopLevel(parent)
    ? { parent: { parentId: customId, parentSlug: null } }
    : { refusal: "parent-is-nested" };
};
