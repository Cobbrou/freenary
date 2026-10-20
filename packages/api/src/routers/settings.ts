import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  MAX_AMOUNT_MINOR_UNITS,
  MAX_BUDGET_LINE_LABEL_LENGTH,
  MAX_BUDGET_LINES,
} from "../lib/budget-profile";
import {
  customCategoryDisplayColor,
  customCategoryKey,
  customCategoryPickedColor,
  parseCategoryKey,
  predefinedCategoryGroups,
} from "../lib/categories";
import type { CategoryEntry } from "../lib/categories";
import {
  isCustomCategoryParentRefused,
  resolveCustomCategoryParent,
} from "../lib/custom-category-parent";
import type {
  CustomCategoryParentRefusal,
  ResolvedCustomCategoryParent,
} from "../lib/custom-category-parent";
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_GROUP_FALLBACKS,
  CATEGORY_ICON_NAMES,
  isCategoryGroup,
  resolveCategoryGroup,
} from "../lib/taxonomy";
import type { CategoryIconName } from "../lib/taxonomy";

const customCategoryFields = {
  color: z.enum(CATEGORY_COLOR_VALUES),
  icon: z.enum(CATEGORY_ICON_NAMES),
  label: z.string().trim().min(1).max(40),
  parentKey: z.string().nullable(),
};

const PARENT_REFUSAL_ERRORS = {
  "not-a-category": {
    code: "BAD_REQUEST",
    message: "Unknown parent category",
  },
  "parent-is-itself": {
    code: "BAD_REQUEST",
    message: "A category cannot be its own parent",
  },
  "parent-is-nested": {
    code: "BAD_REQUEST",
    message: "A subcategory cannot hold subcategories",
  },
  "parent-not-found": {
    code: "NOT_FOUND",
    message: "Parent category not found",
  },
  "would-nest-a-parent": {
    code: "BAD_REQUEST",
    message: "A category with subcategories cannot be nested",
  },
} as const satisfies Record<
  CustomCategoryParentRefusal,
  { code: "BAD_REQUEST" | "NOT_FOUND"; message: string }
>;

const lockOwnCategories = (tx: Prisma.TransactionClient, userId: string) =>
  tx.$queryRaw`SELECT "id" FROM "custom_category" WHERE "userId" = ${userId} FOR UPDATE`;

const resolveParentOrRefuse = async (
  tx: Prisma.TransactionClient,
  input: {
    categoryId: string | null;
    parentKey: string | null;
    userId: string;
  }
): Promise<ResolvedCustomCategoryParent> => {
  await lockOwnCategories(tx, input.userId);

  const owned = await tx.customCategory.findMany({
    select: { id: true, parentId: true, parentSlug: true },
    where: { userId: input.userId },
  });

  const outcome = resolveCustomCategoryParent({
    categoryId: input.categoryId,
    owned,
    parentKey: input.parentKey,
  });

  if (isCustomCategoryParentRefused(outcome)) {
    const refusal = PARENT_REFUSAL_ERRORS[outcome.refusal];

    throw new ORPCError(refusal.code, { message: refusal.message });
  }

  return outcome.parent;
};

const CATEGORY_SELECT = {
  _count: { select: { budgetLines: true } },
  color: true,
  icon: true,
  id: true,
  label: true,
  parent: { select: { color: true } },
  parentId: true,
  parentSlug: true,
} as const;

const parentKeyOf = (custom: {
  parentId: string | null;
  parentSlug: string | null;
}): string | null => {
  if (custom.parentId) {
    return customCategoryKey(custom.parentId);
  }

  return custom.parentSlug ? resolveCategoryGroup(custom.parentSlug) : null;
};

// SAFETY: icon is only ever written through the zod-validated mutations in this file
const toCategoryEntry = (custom: {
  _count: { budgetLines: number };
  color: string;
  icon: string;
  id: string;
  label: string;
  parent: { color: string } | null;
  parentId: string | null;
  parentSlug: string | null;
}): CategoryEntry => ({
  color: customCategoryDisplayColor({
    chosen: custom.color,
    parentChosenColor: custom.parent?.color ?? null,
    parentSlug: custom.parentSlug,
  }),
  icon: custom.icon as CategoryIconName,
  isAssignable: true,
  isCustom: true,
  isGroup: custom.parentSlug === null && custom.parentId === null,
  key: customCategoryKey(custom.id),
  label: custom.label,
  parentKey: parentKeyOf(custom),
  pickedColor: customCategoryPickedColor(custom.color),
  usageCount: custom._count.budgetLines,
});

const nextSortOrder = async (
  tx: Prisma.TransactionClient,
  userId: string,
  parent: ResolvedCustomCategoryParent
) => {
  const last = await tx.customCategory.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
    where: { parentId: parent.parentId, parentSlug: parent.parentSlug, userId },
  });

  return (last?.sortOrder ?? -1) + 1;
};

export const settingsRouter = {
  createCustomCategory: protectedProcedure
    .input(z.object({ ...customCategoryFields }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const created = await prisma.$transaction(async (tx) => {
        const clash = await tx.customCategory.findFirst({
          select: { id: true },
          where: {
            label: { equals: input.label, mode: "insensitive" },
            userId,
          },
        });

        if (clash) {
          throw new ORPCError("CONFLICT", {
            message: "A category with that name already exists",
          });
        }

        const parent = await resolveParentOrRefuse(tx, {
          categoryId: null,
          parentKey: input.parentKey,
          userId,
        });

        return tx.customCategory.create({
          data: {
            color: input.color,
            icon: input.icon,
            label: input.label,
            parentId: parent.parentId,
            parentSlug: parent.parentSlug,
            sortOrder: await nextSortOrder(tx, userId, parent),
            userId,
          },
          select: { id: true },
        });
      });

      return { key: customCategoryKey(created.id) };
    }),

  deleteCustomCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      return await prisma.$transaction(async (tx) => {
        await lockOwnCategories(tx, userId);

        const category = await tx.customCategory.findFirst({
          select: {
            children: { select: { id: true } },
            id: true,
            parentId: true,
            parentSlug: true,
          },
          where: { id: input.id, userId },
        });

        if (!category) {
          throw new ORPCError("NOT_FOUND", { message: "Category not found" });
        }

        const fallbackSlug =
          category.parentSlug && isCategoryGroup(category.parentSlug)
            ? CATEGORY_GROUP_FALLBACKS[category.parentSlug]
            : "uncategorised";

        const removedIds = [
          category.id,
          ...category.children.map((child) => child.id),
        ];

        const reassigned = await tx.budgetLine.updateMany({
          data: { categoryId: null, categorySlug: fallbackSlug },
          where: { categoryId: { in: removedIds } },
        });

        await tx.customCategory.delete({ where: { id: category.id } });

        return {
          deletedSubcategories: category.children.length,
          fallbackSlug,
          reassignedLines: reassigned.count,
        };
      });
    }),

  getBudgetProfile: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const lines = await prisma.budgetLine.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        amount: true,
        categoryId: true,
        categorySlug: true,
        id: true,
        label: true,
      },
      where: { userId },
    });

    return {
      lines: lines.map((line) => ({
        amount: line.amount,
        categoryKey: line.categoryId
          ? customCategoryKey(line.categoryId)
          : (line.categorySlug ?? "uncategorised"),
        id: line.id,
        label: line.label,
      })),
    };
  }),

  listCategories: protectedProcedure.handler(async ({ context }) => {
    const customs = await prisma.customCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: CATEGORY_SELECT,
      where: { userId: context.session.user.id },
    });

    const categories: CategoryEntry[] = [];
    const customEntries = customs.map(toCategoryEntry);

    for (const {
      categories: predefined,
      group,
    } of predefinedCategoryGroups()) {
      categories.push(group, ...predefined);

      for (const custom of customEntries) {
        if (custom.parentKey === group.key) {
          categories.push(custom);
        }
      }
    }

    for (const custom of customEntries) {
      if (custom.isGroup) {
        categories.push(
          custom,
          ...customEntries.filter((child) => child.parentKey === custom.key)
        );
      }
    }

    return { categories };
  }),

  moveCustomCategory: protectedProcedure
    .input(z.object({ direction: z.enum(["down", "up"]), id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const current = await prisma.customCategory.findFirst({
        select: {
          id: true,
          parentId: true,
          parentSlug: true,
          sortOrder: true,
        },
        where: { id: input.id, userId },
      });

      if (!current) {
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      }

      const movingUp = input.direction === "up";

      const neighbour = await prisma.customCategory.findFirst({
        orderBy: { sortOrder: movingUp ? "desc" : "asc" },
        select: { id: true, sortOrder: true },
        where: {
          parentId: current.parentId,
          parentSlug: current.parentSlug,
          sortOrder: movingUp
            ? { lt: current.sortOrder }
            : { gt: current.sortOrder },
          userId,
        },
      });

      if (!neighbour) {
        return { moved: false };
      }

      await prisma.$transaction([
        prisma.customCategory.update({
          data: { sortOrder: neighbour.sortOrder },
          where: { id: current.id },
        }),
        prisma.customCategory.update({
          data: { sortOrder: current.sortOrder },
          where: { id: neighbour.id },
        }),
      ]);

      return { moved: true };
    }),

  saveBudgetProfile: protectedProcedure
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              amount: z.number().int().min(0).max(MAX_AMOUNT_MINOR_UNITS),
              categoryKey: z.string(),
              label: z.string().trim().max(MAX_BUDGET_LINE_LABEL_LENGTH),
            })
          )
          .max(MAX_BUDGET_LINES),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const owned = await prisma.customCategory.findMany({
        select: { id: true },
        where: { userId },
      });

      const ownedIds = new Set(owned.map((category) => category.id));

      const budgetLines = input.lines.map((line, index) => {
        const parsed = parseCategoryKey(line.categoryKey);

        if (!parsed || (parsed.customId && !ownedIds.has(parsed.customId))) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Unknown category: ${line.categoryKey}`,
          });
        }

        return {
          amount: line.amount,
          categoryId: parsed.customId,
          categorySlug: parsed.slug,
          label: line.label || null,
          sortOrder: index,
          userId,
        };
      });

      await prisma.$transaction([
        prisma.budgetLine.deleteMany({ where: { userId } }),
        prisma.budgetLine.createMany({ data: budgetLines }),
      ]);

      return { lineCount: budgetLines.length };
    }),

  updateCustomCategory: protectedProcedure
    .input(z.object({ ...customCategoryFields, id: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      await prisma.$transaction(async (tx) => {
        const category = await tx.customCategory.findFirst({
          select: {
            parentId: true,
            parentSlug: true,
            sortOrder: true,
          },
          where: { id: input.id, userId },
        });

        if (!category) {
          throw new ORPCError("NOT_FOUND", { message: "Category not found" });
        }

        const clash = await tx.customCategory.findFirst({
          select: { id: true },
          where: {
            id: { not: input.id },
            label: { equals: input.label, mode: "insensitive" },
            userId,
          },
        });

        if (clash) {
          throw new ORPCError("CONFLICT", {
            message: "A category with that name already exists",
          });
        }

        const parent = await resolveParentOrRefuse(tx, {
          categoryId: input.id,
          parentKey: input.parentKey,
          userId,
        });

        const reparented =
          category.parentSlug !== parent.parentSlug ||
          category.parentId !== parent.parentId;

        await tx.customCategory.update({
          data: {
            color: input.color,
            icon: input.icon,
            label: input.label,
            parentId: parent.parentId,
            parentSlug: parent.parentSlug,
            sortOrder: reparented
              ? await nextSortOrder(tx, userId, parent)
              : category.sortOrder,
          },
          where: { id: input.id },
        });
      });

      return { success: true as const };
    }),
};
