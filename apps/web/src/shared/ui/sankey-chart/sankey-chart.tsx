import { cn } from "@freenary/ui/lib/utils";
import { useMemo, useState } from "react";

import {
  ACCENT_W,
  computeSankeyLayout,
  svgLinkPath,
} from "../../lib/sankey/layout";
import type { SankeyFlow, SankeyLayout } from "../../lib/sankey/layout";
import { SankeyNodeLabel } from "./sankey-node-label";

interface SankeyChartProps extends SankeyFlow {
  className?: string;
  formatValue: (value: number) => string;
  label: string;
  onNodeClick?: (nodeId: string) => void;
}

const LINK_OPACITY = 0.28;
const NODE_OPACITY = 0.5;
const ACCENT_OPACITY = 0.85;
const UNRELATED_DIM_FACTOR = 0.25;

const hoverLitIds = (layout: SankeyLayout, hovered: string | null) => {
  const ids = new Set<string>();

  if (!hovered) {
    return ids;
  }

  ids.add(hovered);

  for (const ribbon of layout.links) {
    if (ribbon.sourceId === hovered || ribbon.targetId === hovered) {
      ids.add(ribbon.sourceId);
      ids.add(ribbon.targetId);
      ids.add(ribbon.id);
    }
  }

  return ids;
};

export const SankeyChart = ({
  className,
  columns,
  formatValue,
  label,
  links,
  onNodeClick,
}: SankeyChartProps) => {
  const layout = useMemo(
    () => computeSankeyLayout({ columns, links }),
    [columns, links]
  );

  const [hovered, setHovered] = useState<string | null>(null);

  const lit = useMemo(() => hoverLitIds(layout, hovered), [layout, hovered]);

  const lastColumn = layout.columnCount - 1;

  return (
    <svg
      aria-label={label}
      className={cn("block w-full select-none", className)}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
    >
      <title>{label}</title>
      {layout.links.map((ribbon) => (
        <path
          key={ribbon.id}
          d={svgLinkPath(ribbon)}
          fill={ribbon.color}
          fillOpacity={
            LINK_OPACITY *
            (hovered && !lit.has(ribbon.id) ? UNRELATED_DIM_FACTOR : 1)
          }
          onPointerEnter={() => setHovered(ribbon.targetId)}
          onPointerLeave={() => setHovered(null)}
        />
      ))}

      {layout.nodes.map((node) => {
        const { color } = node;
        const dim = hovered && !lit.has(node.id) ? UNRELATED_DIM_FACTOR : 1;

        return (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              fill={color}
              fillOpacity={NODE_OPACITY * dim}
              style={onNodeClick ? { cursor: "pointer" } : undefined}
              onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
              onPointerEnter={() => setHovered(node.id)}
              onPointerLeave={() => setHovered(null)}
            />
            {node.column !== lastColumn && (
              <rect
                className="pointer-events-none"
                x={node.x}
                y={node.y}
                width={ACCENT_W}
                height={node.h}
                fill={color}
                fillOpacity={ACCENT_OPACITY * dim}
              />
            )}
            {node.column !== 0 && (
              <rect
                className="pointer-events-none"
                x={node.x + node.w - ACCENT_W}
                y={node.y}
                width={ACCENT_W}
                height={node.h}
                fill={color}
                fillOpacity={ACCENT_OPACITY * dim}
              />
            )}
          </g>
        );
      })}

      {layout.nodes.map((node) => (
        <SankeyNodeLabel
          key={`label-${node.id}`}
          formatValue={formatValue}
          isFirstColumn={node.column === 0}
          node={node}
        />
      ))}
    </svg>
  );
};
