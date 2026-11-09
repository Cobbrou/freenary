import { useCallback, useMemo } from "react";

import type { CategorySelection } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { SankeyChart } from "@/shared/ui/sankey-chart";

import { selectionOfNodeId, toCashFlowSankey } from "../model/cash-flow-sankey";
import type { CashFlowData } from "../model/cash-flow-sankey";

interface CashFlowChartProps extends CashFlowData {
  currency: string;
  onSelect?: (selection: CategorySelection) => void;
}

export const CashFlowChart = ({
  currency,
  groups,
  incomeNodes,
  moneyLeft,
  onSelect,
  totalIncome,
}: CashFlowChartProps) => {
  const flow = useMemo(
    () => toCashFlowSankey({ groups, incomeNodes, moneyLeft, totalIncome }),
    [groups, incomeNodes, moneyLeft, totalIncome]
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const selection = selectionOfNodeId(nodeId);

      if (selection && onSelect) {
        onSelect(selection);
      }
    },
    [onSelect]
  );

  if (incomeNodes.length === 0 && groups.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
        {m.budget_cash_flow_empty()}
      </p>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <SankeyChart
        className="max-h-full"
        columns={flow.columns}
        formatValue={(value) => formatCurrency(value, currency)}
        label={m.budget_cash_flow_chart_label()}
        links={flow.links}
        onNodeClick={onSelect ? handleNodeClick : undefined}
      />
    </div>
  );
};
