import type { Prisma } from "@freenary/db";

import { SAVING_CATEGORIES } from "./account-types";
import { INTERNAL_TRANSFER_CATEGORY } from "./taxonomy";
import type { SpendingCategory } from "./taxonomy";
import { effectiveCategory } from "./transaction-category";
import {
  categoryIsNoneOf,
  categoryIsOneOf,
} from "./transaction-filter-conditions";

export const countedWholeWhere: Prisma.TransactionWhereInput = {
  AND: [
    { exclusion: null, isInternalTransfer: false },
    categoryIsNoneOf([INTERNAL_TRANSFER_CATEGORY]),
  ],
};

export const countedInFiguresWhere: Prisma.TransactionWhereInput = {
  AND: [
    { exclusion: null },
    {
      OR: [
        countedWholeWhere,
        {
          AND: [
            { isInternalTransfer: true },
            categoryIsOneOf(SAVING_CATEGORIES),
          ],
        },
        { exchangeFeeMinor: { gt: 0 }, isInternalTransfer: true },
      ],
    },
  ],
};

const SAVING_CATEGORY_SLUGS = new Set<SpendingCategory>(SAVING_CATEGORIES);

export type CountedShare = "exchange-fee" | "none" | "whole";

export const countedShareOf = (row: {
  category: string | null;
  exchangeFeeMinor: number | null;
  exclusion?: string | null;
  isInternalTransfer: boolean;
  resolvedCategory: string | null;
}): CountedShare => {
  if (row.exclusion) {
    return "none";
  }

  const category = effectiveCategory(row);

  if (row.isInternalTransfer && SAVING_CATEGORY_SLUGS.has(category)) {
    return "whole";
  }

  if (row.isInternalTransfer) {
    return (row.exchangeFeeMinor ?? 0) > 0 ? "exchange-fee" : "none";
  }

  return category === INTERNAL_TRANSFER_CATEGORY ? "none" : "whole";
};
