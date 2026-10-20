import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@freenary/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { Skeleton } from "@freenary/ui/components/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";
import { Elevated } from "@freenary/ui/lib/elevated";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

import type { CategorySelection } from "@/entities/category";
import { m } from "@/paraglide/messages.js";

import type { CashFlowData } from "../model/cash-flow-sankey";
import { aggregationLabel } from "../model/period";
import type { AggregationMode } from "../model/period";
import type { CompanionView, PrimaryView } from "../model/search";
import { BudgetVsActualChart } from "./budget-vs-actual-chart";
import { CashFlowChart } from "./cash-flow-chart";
import { FixedVsVariableChart } from "./fixed-vs-variable-chart";
import { PRESS_MOTION } from "./list-controls";
import { SpendingBreakdownChart } from "./spending-breakdown-chart";
import { StaleRegion } from "./stale-region";

type BreakdownData = ComponentProps<typeof SpendingBreakdownChart>["data"];

type PlannedData = Pick<
  ComponentProps<typeof BudgetVsActualChart>,
  "categories" | "hasPlan"
>;

type FixedData = ComponentProps<typeof FixedVsVariableChart>;

interface ChartQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  isStale: boolean;
}

interface BudgetChartsProps {
  activeCategories: SpendingCategory[];
  aggregation: AggregationMode;
  breakdown: ChartQuery<BreakdownData>;
  cashFlow: ChartQuery<CashFlowData>;
  companion: CompanionView;
  fixedVsVariable: ChartQuery<FixedData>;
  onCompanionChange: (view: CompanionView) => void;
  onSelect: (selection: CategorySelection | null) => void;
  onViewChange: (view: PrimaryView) => void;
  planned: ChartQuery<PlannedData>;
  view: PrimaryView;
}

const CHART_BODY = "h-[280px]";

const ChartSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="h-full">
    <output className="sr-only">{label}</output>
    <Skeleton aria-hidden="true" className="h-full" />
  </div>
);

const ChartUnavailable = () => (
  <p className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-xs">
    {m.budget_chart_unavailable()}
  </p>
);

const PrimaryChartBody = ({
  breakdown,
  cashFlow,
  onSelect,
  view,
}: {
  breakdown: ChartQuery<BreakdownData>;
  cashFlow: ChartQuery<CashFlowData>;
  onSelect: (selection: CategorySelection | null) => void;
  view: PrimaryView;
}) => {
  if (view === "flow") {
    if (cashFlow.isPending) {
      return <ChartSkeleton label={m.budget_cash_flow_loading()} />;
    }

    if (cashFlow.isError || !cashFlow.data) {
      return <ChartUnavailable />;
    }

    return (
      <StaleRegion className="h-full" isStale={cashFlow.isStale}>
        <CashFlowChart {...cashFlow.data} onSelect={onSelect} />
      </StaleRegion>
    );
  }

  if (breakdown.isPending) {
    return <ChartSkeleton label={m.budget_breakdown_loading()} />;
  }

  if (breakdown.isError || !breakdown.data) {
    return <ChartUnavailable />;
  }

  return (
    <StaleRegion className="h-full" isStale={breakdown.isStale}>
      <SpendingBreakdownChart data={breakdown.data} onSelect={onSelect} />
    </StaleRegion>
  );
};

const CompanionChartBody = ({
  activeCategories,
  fixedVsVariable,
  onSelect,
  planned,
  view,
}: {
  activeCategories: SpendingCategory[];
  fixedVsVariable: ChartQuery<FixedData>;
  onSelect: (selection: CategorySelection) => void;
  planned: ChartQuery<PlannedData>;
  view: CompanionView;
}) => {
  if (view === "fixed") {
    if (fixedVsVariable.isPending) {
      return <ChartSkeleton label={m.budget_fixed_variable_loading()} />;
    }

    if (fixedVsVariable.isError || !fixedVsVariable.data) {
      return <ChartUnavailable />;
    }

    return (
      <StaleRegion className="h-full" isStale={fixedVsVariable.isStale}>
        <FixedVsVariableChart {...fixedVsVariable.data} />
      </StaleRegion>
    );
  }

  if (planned.isPending) {
    return <ChartSkeleton label={m.budget_planned_loading()} />;
  }

  if (planned.isError || !planned.data) {
    return <ChartUnavailable />;
  }

  return (
    <StaleRegion className="h-full" isStale={planned.isStale}>
      <BudgetVsActualChart
        activeCategories={activeCategories}
        {...planned.data}
        onSelect={onSelect}
      />
    </StaleRegion>
  );
};

export const BudgetCharts = ({
  activeCategories,
  aggregation,
  breakdown,
  cashFlow,
  companion,
  fixedVsVariable,
  onCompanionChange,
  onSelect,
  onViewChange,
  planned,
  view,
}: BudgetChartsProps) => (
  <div className="grid grid-cols-1 gap-4 @min-[52rem]/budget:grid-cols-[2fr_1fr]">
    <Elevated className="min-w-0 rounded-xl" offset={1}>
      <Card>
        <CardHeader>
          <CardTitle className="truncate">
            {view === "flow"
              ? m.budget_cash_flow_title()
              : m.budget_breakdown_title()}
            {aggregation !== "total" && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {aggregationLabel(aggregation)}
              </span>
            )}
          </CardTitle>
          <CardAction>
            <ToggleGroup
              aria-label={m.budget_view_switch_label()}
              onValueChange={([next]) => {
                if (next === "flow" || next === "categories") {
                  onViewChange(next);
                }
              }}
              size="sm"
              spacing={0}
              value={[view]}
              variant="outline"
            >
              <ToggleGroupItem
                render={<motion.button {...PRESS_MOTION} />}
                value="flow"
              >
                {m.budget_view_flow()}
              </ToggleGroupItem>
              <ToggleGroupItem
                render={<motion.button {...PRESS_MOTION} />}
                value="categories"
              >
                {m.budget_view_categories()}
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className={CHART_BODY}>
          <PrimaryChartBody
            breakdown={breakdown}
            cashFlow={cashFlow}
            onSelect={onSelect}
            view={view}
          />
        </CardContent>
      </Card>
    </Elevated>

    <Elevated className="min-w-0 rounded-xl" offset={1}>
      <Card>
        <CardHeader>
          <Select
            onValueChange={(next) =>
              onCompanionChange(next === "planned" ? "planned" : "fixed")
            }
            size="compact"
            value={companion}
          >
            <motion.div {...PRESS_MOTION} className="flex">
              <SelectTrigger aria-label={m.budget_companion_switch_label()} />
            </motion.div>
            <SelectContent>
              <SelectGroup>
                <SelectItem index={0} value="fixed">
                  {m.budget_view_fixed_variable()}
                </SelectItem>
                <SelectItem index={1} value="planned">
                  {m.budget_view_planned()}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className={CHART_BODY}>
          <CompanionChartBody
            activeCategories={activeCategories}
            fixedVsVariable={fixedVsVariable}
            onSelect={onSelect}
            planned={planned}
            view={companion}
          />
        </CardContent>
      </Card>
    </Elevated>
  </div>
);
