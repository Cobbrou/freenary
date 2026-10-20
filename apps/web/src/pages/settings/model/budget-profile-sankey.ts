import type { BudgetLineKind } from "@freenary/api/lib/budget-profile";
import type { CategoryColor } from "@freenary/api/lib/taxonomy";

import { m } from "@/paraglide/messages.js";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { apportion } from "@/shared/lib/sankey";
import type { SankeyFlow, SankeyLink, SankeyNode } from "@/shared/lib/sankey";

export interface BudgetProfileLine {
  amount: number;
  groupColor: CategoryColor;
  groupKey: string;
  groupLabel: string;
  id: string;
  kind: BudgetLineKind;
  label: string;
}

interface LineGroup {
  color: CategoryColor;
  label: string;
  lines: BudgetProfileLine[];
  value: number;
}

const MONEY_LEFT_ID = "money-left";

export const toBudgetProfileSankey = (
  lines: BudgetProfileLine[]
): SankeyFlow => {
  const revenues = lines.filter((line) => line.kind === "REVENUE");
  const allocations = [
    ...lines.filter((line) => line.kind === "INVESTMENT"),
    ...lines.filter((line) => line.kind === "OUTGOING"),
  ];

  const totalRevenue = revenues.reduce((total, line) => total + line.amount, 0);
  const totalAllocated = allocations.reduce(
    (total, line) => total + line.amount,
    0
  );

  const groupsInAppearanceOrder = new Map<string, LineGroup>();

  for (const line of allocations) {
    const group = groupsInAppearanceOrder.get(line.groupKey);

    if (group) {
      group.lines.push(line);
      group.value += line.amount;
    } else {
      groupsInAppearanceOrder.set(line.groupKey, {
        color: line.groupColor,
        label: line.groupLabel,
        lines: [line],
        value: line.amount,
      });
    }
  }

  const groupNodes: SankeyNode[] = [];
  const lineNodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  for (const [groupKey, group] of groupsInAppearanceOrder) {
    const groupId = `group:${groupKey}`;
    groupNodes.push({
      color: CHART_COLOR_VARS[group.color],
      id: groupId,
      label: group.label,
      value: group.value,
    });

    for (const line of group.lines) {
      const lineId = `line:${line.id}`;
      lineNodes.push({
        color: CHART_COLOR_VARS[group.color],
        id: lineId,
        label: line.label,
        value: line.amount,
      });

      links.push({ source: groupId, target: lineId, value: line.amount });
    }
  }

  const moneyLeft = totalRevenue - totalAllocated;

  if (moneyLeft > 0) {
    groupNodes.push({
      color: CHART_COLOR_VARS.grey,
      id: MONEY_LEFT_ID,
      label: m.settings_budget_money_left(),
      value: moneyLeft,
    });
  }

  const sources = revenues.map((line) => ({
    id: `revenue:${line.id}`,
    value: line.amount,
  }));

  return {
    columns: [
      revenues.map((line) => ({
        color: CHART_COLOR_VARS[line.groupColor],
        id: `revenue:${line.id}`,
        label: line.label,
        value: line.amount,
      })),
      groupNodes,
      lineNodes,
    ],
    links: [...apportion(sources, groupNodes), ...links],
  };
};
