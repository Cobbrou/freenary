import { describe, expect, it } from "bun:test";

import { m } from "@/paraglide/messages.js";

import { toCashFlowSankey } from "./cash-flow-sankey";

const incomeColumn = (incomeNodes: { name: string | null; value: number }[]) =>
  toCashFlowSankey({
    groups: [],
    incomeNodes,
    moneyLeft: 0,
    totalIncome: 0,
  }).columns[0];

describe("toCashFlowSankey", () => {
  it("labels the unnamed income bucket from the message catalog", () => {
    const [bucket] = incomeColumn([{ name: null, value: 100 }]);

    expect(bucket?.label).toBe(m.category_other_income());
  });

  it("keeps a counterparty named like the bucket as its own node", () => {
    const nodes = incomeColumn([
      { name: null, value: 100 },
      { name: "Other Income", value: 50 },
    ]);

    expect(nodes.map((node) => node.label)).toEqual([
      m.category_other_income(),
      "Other Income",
    ]);

    expect(new Set(nodes.map((node) => node.id)).size).toBe(2);
  });
});
