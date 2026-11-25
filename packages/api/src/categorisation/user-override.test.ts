import { describe, expect, it } from "bun:test";

import type { Prisma } from "@freenary/db";

import { deleteUserOverride, userCategoryUpdate } from "./user-override";

describe("userCategoryUpdate", () => {
  it("takes a transaction categorised by hand out of its internal transfer", () => {
    expect(userCategoryUpdate("shopping", true)).toEqual({
      category: "shopping",
      categoryOverride: true,
      exchangeFeeMinor: null,
      isInternalTransfer: false,
      resolutionConfidence: null,
      resolutionStage: null,
      resolvedCategory: null,
    });
  });

  it("keeps what the pipeline wrote on any other transaction", () => {
    expect(userCategoryUpdate("shopping", false)).toEqual({
      category: "shopping",
      categoryOverride: true,
    });
  });

  it("keeps the internal transfer when the category is cleared", () => {
    expect(userCategoryUpdate(null, true)).toEqual({
      category: null,
      categoryOverride: false,
    });
  });
});

describe("deleteUserOverride", () => {
  it("clears the categories the override resolved on the merchant's transactions", async () => {
    const cleared: Prisma.TransactionUpdateManyArgs[] = [];

    await deleteUserOverride("user", "netflix", {
      merchantOverride: { deleteMany: () => Promise.resolve({ count: 1 }) },
      transaction: {
        updateMany: (args) => {
          cleared.push(args);

          return Promise.resolve({ count: 2 });
        },
      },
    });

    expect(cleared).toEqual([
      {
        data: {
          resolutionConfidence: null,
          resolutionStage: null,
          resolvedCategory: null,
        },
        where: {
          account: { connection: { userId: "user" } },
          categoryOverride: false,
          merchantKey: "netflix",
          resolutionStage: "user-override",
        },
      },
    ]);
  });
});
