import { describe, expect, it } from "bun:test";

import { cashFlowAccountsOf } from "../lib/account-types";
import { countedTransactionsWhere } from "./budget";

describe("countedTransactionsWhere", () => {
  it("leaves internal transfers out unless they moved money into savings", () => {
    const from = new Date("2026-10-01T00:00:00.000Z");
    const to = new Date("2026-10-31T23:59:59.999Z");

    expect(countedTransactionsWhere("user", from, to)).toEqual({
      OR: [
        { isInternalTransfer: false },
        { resolvedCategory: { in: ["retirement", "savings", "securities"] } },
      ],
      account: cashFlowAccountsOf("user"),
      date: { gte: from, lte: to },
    });
  });
});
