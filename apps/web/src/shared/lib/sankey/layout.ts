export interface SankeyNode {
  color: string;
  id: string;
  label: string;
  value: number;
}

export interface SankeyLink {
  source: SankeyNode["id"];
  target: SankeyNode["id"];
  value: number;
}

export interface SankeyFlow {
  columns: SankeyNode[][];
  links: SankeyLink[];
}

export interface NodeRect {
  color: string;
  column: number;
  h: number;
  id: SankeyNode["id"];
  label: string;
  labelBudget: number;
  value: number;
  w: number;
  x: number;
  y: number;
}

export interface LinkBand {
  color: string;
  id: string;
  sourceId: SankeyNode["id"];
  sx: number;
  sy0: number;
  sy1: number;
  targetId: SankeyNode["id"];
  tx: number;
  ty0: number;
  ty1: number;
}

export interface SankeyLayout {
  columnCount: number;
  height: number;
  links: LinkBand[];
  nodes: NodeRect[];
  width: number;
}

export const CHART_WIDTH = 700;
export const ACCENT_W = 3;
export const LABEL_MIN_H = 28;
export const LABEL_INSET = 6;

const PAD_PX = { bottom: 16, left: 12, right: 12, top: 20 };
const COLUMN_WIDTH_FRACTION = 0.22;
const COLUMN_GAP_FRACTION = 0.17;
const NODE_GAP_PX = 6;
const MIN_NODE_H_PX = 16;
const MAX_COLUMN_H_PX = 260;
const MIN_BAND_H_PX = 2;
const CONTESTED_GAP_SHARES = 2;
const FIRST_COLUMN = 0;
const SECOND_COLUMN = 1;

const sumOfValues = (nodes: SankeyNode[]) =>
  nodes.reduce((total, node) => total + node.value, 0);

export const svgLinkPath = (band: LinkBand): string => {
  const controlX = (band.sx + band.tx) / 2;

  return [
    `M${band.sx},${band.sy0}`,
    `C${controlX},${band.sy0} ${controlX},${band.ty0} ${band.tx},${band.ty0}`,
    `L${band.tx},${band.ty1}`,
    `C${controlX},${band.ty1} ${controlX},${band.sy1} ${band.sx},${band.sy1}`,
    "Z",
  ].join(" ");
};

const normalisedColumnMetrics = (columnCount: number) => {
  const usableWidth = CHART_WIDTH - PAD_PX.left - PAD_PX.right;
  const fractionsSpanned =
    columnCount * COLUMN_WIDTH_FRACTION +
    Math.max(0, columnCount - 1) * COLUMN_GAP_FRACTION;

  const scaleToFillUsableWidth = 1 / fractionsSpanned;

  return {
    columnGapW: usableWidth * COLUMN_GAP_FRACTION * scaleToFillUsableWidth,
    columnW: usableWidth * COLUMN_WIDTH_FRACTION * scaleToFillUsableWidth,
  };
};

const stackColumn = (
  nodes: SankeyNode[],
  column: number,
  x: number,
  w: number,
  tallestColumnValue: number
) => {
  const rects: NodeRect[] = [];
  let y = PAD_PX.top;

  for (const node of nodes) {
    const h = Math.max(
      MIN_NODE_H_PX,
      (node.value / tallestColumnValue) * MAX_COLUMN_H_PX
    );

    rects.push({ ...node, column, h, labelBudget: 0, w, x, y });
    y += h + NODE_GAP_PX;
  }

  return { bottom: y, rects };
};

const bandHeightAt = (value: number, node: NodeRect) =>
  node.value > 0
    ? Math.max(MIN_BAND_H_PX, (value / node.value) * node.h)
    : MIN_BAND_H_PX;

const labelsBesideItself = (rect: NodeRect) => rect.h < LABEL_MIN_H;

const sharesRows = (a: NodeRect, b: NodeRect) =>
  a.y < b.y + b.h && b.y < a.y + a.h;

const assignLabelBudgets = (nodes: NodeRect[], columnGapW: number) => {
  const writingRightwards = nodes.filter(
    (rect) => rect.column === FIRST_COLUMN && labelsBesideItself(rect)
  );

  const writingLeftwards = nodes.filter(
    (rect) => rect.column === SECOND_COLUMN && labelsBesideItself(rect)
  );

  for (const rect of nodes) {
    let rivals: NodeRect[] = [];

    if (rect.column === FIRST_COLUMN) {
      rivals = writingLeftwards;
    } else if (rect.column === SECOND_COLUMN) {
      rivals = writingRightwards;
    }

    const gapIsContested = rivals.some((rival) => sharesRows(rect, rival));
    const shareOfGapW = gapIsContested
      ? columnGapW / CONTESTED_GAP_SHARES
      : columnGapW;

    const roomToChartEdge = CHART_WIDTH - PAD_PX.right - (rect.x + rect.w);
    const room = rect.column === FIRST_COLUMN ? roomToChartEdge : shareOfGapW;

    rect.labelBudget = Math.max(0, Math.min(shareOfGapW, room) - LABEL_INSET);
  }
};

const outgoingByNodeId = (links: SankeyLink[]) => {
  const outgoing = new Map<string, SankeyLink[]>();

  for (const link of links) {
    const forSource = outgoing.get(link.source);

    if (forSource) {
      forSource.push(link);
    } else {
      outgoing.set(link.source, [link]);
    }
  }

  return outgoing;
};

const stackLinkBands = (nodes: NodeRect[], links: SankeyLink[]) => {
  const nodeById = new Map(nodes.map((rect) => [rect.id, rect]));
  const outgoing = outgoingByNodeId(links);
  const bands: LinkBand[] = [];
  const outboundOffsets = new Map<string, number>();
  const inboundOffsets = new Map<string, number>();

  for (const rect of nodes) {
    for (const link of outgoing.get(rect.id) ?? []) {
      const target = nodeById.get(link.target);

      if (!target || target.column !== rect.column + 1 || link.value <= 0) {
        continue;
      }

      const sourceSlice = bandHeightAt(link.value, rect);
      const targetSlice = bandHeightAt(link.value, target);
      const sourceOffset = outboundOffsets.get(rect.id) ?? 0;
      const targetOffset = inboundOffsets.get(target.id) ?? 0;

      bands.push({
        color: rect.column === FIRST_COLUMN ? rect.color : target.color,
        id: `${link.source}→${link.target}`,
        sourceId: rect.id,
        sx: rect.x + rect.w,
        sy0: rect.y + sourceOffset,
        sy1: rect.y + sourceOffset + sourceSlice,
        targetId: target.id,
        tx: target.x,
        ty0: target.y + targetOffset,
        ty1: target.y + targetOffset + targetSlice,
      });

      outboundOffsets.set(rect.id, sourceOffset + sourceSlice);
      inboundOffsets.set(target.id, targetOffset + targetSlice);
    }
  }

  return bands;
};

export const computeSankeyLayout = ({
  columns,
  links,
}: SankeyFlow): SankeyLayout => {
  const columnCount = Math.max(1, columns.length);
  const { columnGapW, columnW } = normalisedColumnMetrics(columnCount);
  const tallestColumnValue = Math.max(1, ...columns.map(sumOfValues));

  const nodes: NodeRect[] = [];
  let bottom = PAD_PX.top;

  for (const [index, column] of columns.entries()) {
    const stacked = stackColumn(
      column,
      index,
      PAD_PX.left + index * (columnW + columnGapW),
      columnW,
      tallestColumnValue
    );

    nodes.push(...stacked.rects);
    bottom = Math.max(bottom, stacked.bottom);
  }

  assignLabelBudgets(nodes, columnGapW);

  return {
    columnCount,
    height: bottom + PAD_PX.bottom,
    links: stackLinkBands(nodes, links),
    nodes,
    width: CHART_WIDTH,
  };
};
