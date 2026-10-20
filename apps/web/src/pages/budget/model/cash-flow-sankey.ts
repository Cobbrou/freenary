import {
  CATEGORY_GROUP_COLORS,
  isCategoryGroup,
  isSpendingCategory,
} from "@freenary/api/lib/taxonomy";
import type {
  CategoryColor,
  CategoryGroup,
  SpendingCategory,
} from "@freenary/api/lib/taxonomy";

import { categoryGroupLabel, categoryLabel } from "@/entities/category";
import type { CategorySelection } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import {
  categoryChartColor,
  CHART_COLOR_VARS,
} from "@/shared/lib/chart-colors";
import { apportion } from "@/shared/lib/sankey";
import type { SankeyFlow, SankeyLink, SankeyNode } from "@/shared/lib/sankey";

export interface IncomeSource {
  name: string;
  value: number;
}

export interface ExpenseCategory {
  category: SpendingCategory;
  value: number;
}

export interface ExpenseGroup {
  categories: ExpenseCategory[];
  group: CategoryGroup;
  value: number;
}

export interface CashFlowData {
  groups: ExpenseGroup[];
  incomeNodes: IncomeSource[];
  moneyLeft: number;
  totalIncome: number;
}

const GROUP_PREFIX = "group:";
const CATEGORY_PREFIX = "category:";
const INCOME_PREFIX = "income:";
const MONEY_LEFT_ID = `${GROUP_PREFIX}money-left`;

const SALARY = /salary|lön|wage|payroll/u;
const DIVIDEND = /dividend|divi/u;
const INTEREST = /interest|ränta/u;
const REFUND = /refund|return/u;

const DEFAULT_INCOME_COLOR: CategoryColor = "green";

const incomeColorOfCounterpartyName = (name: string): CategoryColor => {
  const lower = name.toLowerCase();

  if (DIVIDEND.test(lower)) {
    return "purple";
  }

  if (INTEREST.test(lower)) {
    return "blue";
  }

  if (REFUND.test(lower)) {
    return "orange";
  }

  if (SALARY.test(lower)) {
    return "green";
  }

  return DEFAULT_INCOME_COLOR;
};

const incomeNodeId = (name: string) => `${INCOME_PREFIX}${name}`;
const groupNodeId = (group: CategoryGroup) => `${GROUP_PREFIX}${group}`;

const categoryNodeId = (category: SpendingCategory) =>
  `${CATEGORY_PREFIX}${category}`;

export const selectionOfNodeId = (nodeId: string): CategorySelection | null => {
  if (nodeId.startsWith(GROUP_PREFIX)) {
    const group = nodeId.slice(GROUP_PREFIX.length);

    return isCategoryGroup(group) ? { group, kind: "group" } : null;
  }

  if (nodeId.startsWith(CATEGORY_PREFIX)) {
    const category = nodeId.slice(CATEGORY_PREFIX.length);

    return isSpendingCategory(category) ? { category, kind: "category" } : null;
  }

  return null;
};

export const toCashFlowSankey = ({
  groups,
  incomeNodes,
  moneyLeft,
}: CashFlowData): SankeyFlow => {
  const groupToCategoryLinks: SankeyLink[] = [];
  const groupNodes: SankeyNode[] = [];
  const categoryNodesInGroupOrder: SankeyNode[] = [];

  for (const group of groups) {
    const id = groupNodeId(group.group);
    groupNodes.push({
      color: CHART_COLOR_VARS[CATEGORY_GROUP_COLORS[group.group]],
      id,
      label: categoryGroupLabel(group.group),
      value: group.value,
    });

    for (const category of group.categories) {
      categoryNodesInGroupOrder.push({
        color: categoryChartColor(category.category),
        id: categoryNodeId(category.category),
        label: categoryLabel(category.category),
        value: category.value,
      });

      groupToCategoryLinks.push({
        source: id,
        target: categoryNodeId(category.category),
        value: category.value,
      });
    }
  }

  if (moneyLeft > 0) {
    groupNodes.push({
      color: CHART_COLOR_VARS.grey,
      id: MONEY_LEFT_ID,
      label: m.budget_money_left(),
      value: moneyLeft,
    });
  }

  const sources = incomeNodes.map((node) => ({
    id: incomeNodeId(node.name),
    value: node.value,
  }));

  return {
    columns: [
      incomeNodes.map((node) => ({
        color: CHART_COLOR_VARS[incomeColorOfCounterpartyName(node.name)],
        id: incomeNodeId(node.name),
        label: node.name,
        value: node.value,
      })),
      groupNodes,
      categoryNodesInGroupOrder,
    ],
    links: [...apportion(sources, groupNodes), ...groupToCategoryLinks],
  };
};
