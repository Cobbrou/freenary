import { describe, expect, it } from "bun:test";

import { matchInternalTransfers } from "./internal-transfer";

describe("matchInternalTransfers", () => {
  it("returns 0 for non-existent user", async () => {
    const matched = await matchInternalTransfers("nonexistent-user-id");

    expect(matched).toBe(0);
  });

  it("never throws on empty input", async () => {
    const matched = await matchInternalTransfers("");

    expect(matched).toBe(0);
  });
});
