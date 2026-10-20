import { LABEL_INSET, LABEL_MIN_H } from "../../lib/sankey/layout";
import type { NodeRect } from "../../lib/sankey/layout";
import { fitSideLabel } from "../../lib/sankey/side-label";

interface SankeyNodeLabelProps {
  formatValue: (value: number) => string;
  isFirstColumn: boolean;
  node: NodeRect;
}

const MAX_LABEL_CHARS = 22;
const TRUNCATED_CHARS = 20;
const SIDE_LABEL_CHAR_WIDTH = 4.6;

export const SankeyNodeLabel = ({
  formatValue,
  isFirstColumn,
  node,
}: SankeyNodeLabelProps) => {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const labelText =
    node.label.length > MAX_LABEL_CHARS
      ? `${node.label.slice(0, TRUNCATED_CHARS)}…`
      : node.label;

  if (node.h >= LABEL_MIN_H) {
    return (
      <g className="pointer-events-none">
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[9px] font-medium"
        >
          {labelText}
        </text>
        <text
          x={cx}
          y={cy + 7}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground/70 text-[8px]"
        >
          {formatValue(node.value)}
        </text>
      </g>
    );
  }

  const maxSideLabelChars = Math.floor(
    node.labelBudget / SIDE_LABEL_CHAR_WIDTH
  );

  const fitted = fitSideLabel(
    node.label,
    formatValue(node.value),
    maxSideLabelChars
  );

  if (fitted === null) {
    return null;
  }

  return (
    <text
      x={isFirstColumn ? node.x + node.w + LABEL_INSET : node.x - LABEL_INSET}
      y={cy}
      textAnchor={isFirstColumn ? "start" : "end"}
      dominantBaseline="central"
      className="fill-muted-foreground pointer-events-none text-[9px]"
    >
      {fitted}
    </text>
  );
};
