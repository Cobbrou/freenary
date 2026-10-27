import { describe, expect, test } from "bun:test";

import { incomeNodesOf, incomeSourceOf } from "./income-nodes";

const namedSources = (count: number): [string, number][] =>
  Array.from({ length: count }, (_, index) => [
    `Source ${index}`,
    1000 - index,
  ]);

describe("incomeSourceOf", () => {
  test("keys a transaction with no counterparty as null, not as a name", () => {
    expect(incomeSourceOf({ counterpartyName: null })).toBeNull();
    expect(incomeSourceOf({ counterpartyName: "Other Income" })).toBe(
      "Other Income"
    );
  });
});

describe("incomeNodesOf", () => {
  test("keeps a counterparty named Other Income apart from the unnamed bucket", () => {
    const sources = new Map<string | null, number>();

    for (const tx of [
      { amount: 60, counterpartyName: null },
      { amount: 50, counterpartyName: "Other Income" },
      { amount: 40, counterpartyName: null },
    ]) {
      const source = incomeSourceOf(tx);
      sources.set(source, (sources.get(source) ?? 0) + tx.amount);
    }

    expect(incomeNodesOf(sources)).toEqual([
      { name: null, value: 100 },
      { name: "Other Income", value: 50 },
    ]);
  });

  test("folds the sources beyond the top 10 into a null node", () => {
    const nodes = incomeNodesOf(new Map(namedSources(12)));

    expect(nodes).toHaveLength(11);
    expect(nodes.at(-1)).toEqual({ name: null, value: 990 + 989 });
  });

  test("adds the sources beyond the top 10 to the unnamed bucket", () => {
    const nodes = incomeNodesOf(
      new Map<string | null, number>([[null, 5000], ...namedSources(11)])
    );

    expect(nodes).toHaveLength(10);
    expect(nodes[0]).toEqual({ name: null, value: 5000 + 991 + 990 });
  });
});
