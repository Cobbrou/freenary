import { describe, expect, it } from "bun:test";

import type { Prisma } from "@freenary/db";

import { deleteUserOverride } from "./user-override";

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
