import { describe, expect, it } from "bun:test";

import {
  matchInternalTransfers,
  pairedLegs,
  transferLegUpdates,
} from "./internal-transfer";

describe("matchInternalTransfers", () => {
  it("returns 0 for non-existent user", async () => {
    const matched = await matchInternalTransfers("nonexistent-user-id", null);

    expect(matched).toBe(0);
  });

  it("never throws on empty input", async () => {
    const matched = await matchInternalTransfers("", null);

    expect(matched).toBe(0);
  });
});

const leg = (id: string, accountId: string, amount: number) => ({
  accountId,
  amount,
  currency: "EUR",
  date: new Date("2026-05-02T00:00:00Z"),
  id,
});

describe("transferLegUpdates", () => {
  const accountTypes = new Map([
    ["checking", "CHECKING"],
    ["joint", "CHECKING"],
    ["livret", "LIVRET_A"],
    ["pea", "PEA"],
  ]);

  it("files the current account leg of a deposit by where the money went", () => {
    const pairs = pairedLegs([
      leg("to-livret", "checking", -20_000),
      leg("livret-in", "livret", 20_000),
      leg("to-pea", "checking", -15_000),
      leg("pea-in", "pea", 15_000),
    ]);

    const { flagged, saved } = transferLegUpdates(pairs, accountTypes);

    expect(flagged.toSorted()).toEqual(
      ["livret-in", "pea-in", "to-livret", "to-pea"].toSorted()
    );

    expect(saved).toEqual(
      new Map([
        ["savings", ["to-livret"]],
        ["securities", ["to-pea"]],
      ])
    );
  });

  it("leaves a move between two current accounts or out of savings without a category", () => {
    const pairs = pairedLegs([
      leg("to-joint", "checking", -5000),
      leg("joint-in", "joint", 5000),
      leg("from-livret", "livret", -8000),
      leg("checking-in", "checking", 8000),
    ]);

    const { flagged, saved } = transferLegUpdates(pairs, accountTypes);

    expect(flagged).toHaveLength(4);
    expect(saved.size).toBe(0);
  });
});
