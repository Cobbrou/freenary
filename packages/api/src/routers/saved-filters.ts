import prisma from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  lenientTransactionFiltersSchema,
  MAX_SAVED_FILTER_NAME_LENGTH,
  MAX_SAVED_FILTERS,
  SAVED_FILTER_LIMIT_ERROR,
  MAX_SEARCH_TEXT_LENGTH,
  transactionFiltersSchema,
} from "../lib/transaction-filters";

const savedFilterInput = z
  .object({
    filters: transactionFiltersSchema,
    name: z.string().trim().min(1).max(MAX_SAVED_FILTER_NAME_LENGTH),
    search: z.string().max(MAX_SEARCH_TEXT_LENGTH).default(""),
  })
  .refine(({ filters, search }) => filters.length > 0 || search.trim() !== "", {
    message: "A saved filter needs a filter or some search text",
    path: ["filters"],
  });

export const savedFilterProcedures = {
  deleteSavedFilter: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const { count } = await prisma.savedFilter.deleteMany({
        where: { id: input.id, userId: context.session.user.id },
      });

      if (count === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Saved filter not found" });
      }

      return { id: input.id };
    }),

  listSavedFilters: protectedProcedure.handler(async ({ context }) => {
    const rows = await prisma.savedFilter.findMany({
      orderBy: { name: "asc" },
      select: { filters: true, id: true, name: true, search: true },
      where: { userId: context.session.user.id },
    });

    return {
      savedFilters: rows.flatMap((row) => {
        const filters = lenientTransactionFiltersSchema.parse(row.filters);
        const isLeftEmpty = filters.length === 0 && row.search.trim() === "";

        return isLeftEmpty
          ? []
          : [{ filters, id: row.id, name: row.name, search: row.search }];
      }),
    };
  }),

  saveFilter: protectedProcedure
    .input(savedFilterInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { filters, name, search } = input;

      return await prisma.$transaction(async (tx) => {
        const existing = await tx.savedFilter.findUnique({
          select: { id: true },
          where: { userId_name: { name, userId } },
        });

        if (!existing) {
          const kept = await tx.savedFilter.count({ where: { userId } });

          if (kept >= MAX_SAVED_FILTERS) {
            throw new ORPCError(SAVED_FILTER_LIMIT_ERROR, {
              message: `Keep at most ${MAX_SAVED_FILTERS} saved filters`,
              status: 400,
            });
          }
        }

        const saved = await tx.savedFilter.upsert({
          create: { filters, name, search, userId },
          select: { id: true, name: true },
          update: { filters, name, search },
          where: { userId_name: { name, userId } },
        });

        return { id: saved.id, name: saved.name, replaced: existing !== null };
      });
    }),
};
