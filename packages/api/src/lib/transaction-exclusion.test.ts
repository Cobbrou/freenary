import { describe, expect, it } from "bun:test";

import { exclusionAfter } from "./transaction-exclusion";

describe("exclusionAfter", () => {
  it("excludes a counted transaction alone or with its merchant", () => {
    expect(exclusionAfter(null, "transaction", true)).toBe("TRANSACTION");
    expect(exclusionAfter(null, "merchant", true)).toBe("MERCHANT");
  });

  it("keeps the first reason a transaction was excluded for", () => {
    expect(exclusionAfter("TRANSACTION", "merchant", true)).toBe("TRANSACTION");
    expect(exclusionAfter("MERCHANT", "transaction", true)).toBe("MERCHANT");
  });

  it("counts a transaction again only through the reason that excluded it", () => {
    expect(exclusionAfter("TRANSACTION", "transaction", false)).toBeNull();
    expect(exclusionAfter("MERCHANT", "merchant", false)).toBeNull();
    expect(exclusionAfter("MERCHANT", "transaction", false)).toBe("MERCHANT");
    expect(exclusionAfter("TRANSACTION", "merchant", false)).toBe(
      "TRANSACTION"
    );
  });
});
