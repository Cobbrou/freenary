import { describe, expect, it } from "bun:test";

import {
  isCustomCategoryParentRefused,
  resolveCustomCategoryParent,
} from "./custom-category-parent";
import type {
  CustomCategoryParentRefusal,
  CustomCategoryParentRow,
  ResolvedCustomCategoryParent,
} from "./custom-category-parent";

interface ResolverInput {
  categoryId: string | null;
  owned: CustomCategoryParentRow[];
  parentKey: string | null;
}

const TOP_LEVEL: CustomCategoryParentRow = {
  id: "top",
  parentId: null,
  parentSlug: null,
};

const IN_A_GROUP: CustomCategoryParentRow = {
  id: "in-a-group",
  parentId: null,
  parentSlug: "spending",
};

const NESTED: CustomCategoryParentRow = {
  id: "nested",
  parentId: "top",
  parentSlug: null,
};

const parentOf = (
  input: ResolverInput
): ResolvedCustomCategoryParent | null => {
  const outcome = resolveCustomCategoryParent(input);

  return isCustomCategoryParentRefused(outcome) ? null : outcome.parent;
};

const refusalOf = (
  input: ResolverInput
): CustomCategoryParentRefusal | null => {
  const outcome = resolveCustomCategoryParent(input);

  return isCustomCategoryParentRefused(outcome) ? outcome.refusal : null;
};

describe("resolveCustomCategoryParent", () => {
  it("clears both parents for a null key, whatever the row carries", () => {
    expect(
      parentOf({
        categoryId: "top",
        owned: [TOP_LEVEL, NESTED],
        parentKey: null,
      })
    ).toEqual({ parentId: null, parentSlug: null });
  });

  it("nests under a predefined group when the key is a group slug", () => {
    expect(
      parentOf({
        categoryId: "edited",
        owned: [TOP_LEVEL],
        parentKey: "spending",
      })
    ).toEqual({ parentId: null, parentSlug: "spending" });
  });

  it("nests under a top-level custom category", () => {
    expect(
      parentOf({
        categoryId: "edited",
        owned: [TOP_LEVEL, NESTED],
        parentKey: "custom:top",
      })
    ).toEqual({ parentId: "top", parentSlug: null });
  });

  it("nests a category being created, which names no row of its own", () => {
    expect(
      parentOf({
        categoryId: null,
        owned: [TOP_LEVEL, IN_A_GROUP, NESTED],
        parentKey: "custom:top",
      })
    ).toEqual({ parentId: "top", parentSlug: null });

    expect(
      parentOf({
        categoryId: null,
        owned: [TOP_LEVEL, IN_A_GROUP, NESTED],
        parentKey: "spending",
      })
    ).toEqual({ parentId: null, parentSlug: "spending" });
  });

  it("refuses to nest a category that already holds subcategories", () => {
    expect(
      refusalOf({
        categoryId: "top",
        owned: [TOP_LEVEL, NESTED],
        parentKey: "custom:other",
      })
    ).toBe("would-nest-a-parent");

    expect(
      refusalOf({
        categoryId: "top",
        owned: [TOP_LEVEL, NESTED],
        parentKey: "spending",
      })
    ).toBe("would-nest-a-parent");
  });

  it("nests a category no other row names as its parent", () => {
    expect(
      parentOf({
        categoryId: "in-a-group",
        owned: [TOP_LEVEL, IN_A_GROUP, NESTED],
        parentKey: "custom:top",
      })
    ).toEqual({ parentId: "top", parentSlug: null });
  });

  it("refuses a category naming itself as its parent", () => {
    expect(
      refusalOf({
        categoryId: "top",
        owned: [TOP_LEVEL],
        parentKey: "custom:top",
      })
    ).toBe("parent-is-itself");
  });

  it("refuses a parent the user does not own", () => {
    expect(
      refusalOf({
        categoryId: "edited",
        owned: [TOP_LEVEL],
        parentKey: "custom:someone-else",
      })
    ).toBe("parent-not-found");
  });

  it("refuses a parent that is itself a subcategory", () => {
    expect(
      refusalOf({
        categoryId: "edited",
        owned: [TOP_LEVEL, NESTED],
        parentKey: "custom:nested",
      })
    ).toBe("parent-is-nested");
  });

  it("refuses a parent that sits in a predefined group", () => {
    expect(
      refusalOf({
        categoryId: "edited",
        owned: [TOP_LEVEL, IN_A_GROUP],
        parentKey: "custom:in-a-group",
      })
    ).toBe("parent-is-nested");
  });

  it("refuses a key that names neither a group nor a custom category", () => {
    expect(
      refusalOf({
        categoryId: "edited",
        owned: [TOP_LEVEL],
        parentKey: "groceries",
      })
    ).toBe("not-a-category");

    expect(
      refusalOf({
        categoryId: "edited",
        owned: [TOP_LEVEL],
        parentKey: "custom:",
      })
    ).toBe("not-a-category");
  });
});
