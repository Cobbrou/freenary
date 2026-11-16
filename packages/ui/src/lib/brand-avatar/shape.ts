/**
 * Path construction for the avatar. Every shape is a short list of commands
 * whose points are mapped through one function when a frame is drawn. All the
 * avatar's motion — the turn, the tilt, the hop, the squash — is affine, and
 * an affine map of a Bézier's control points is the same curve transformed,
 * so a frame costs a handful of multiplications and never resamples a shape.
 */

export interface Point {
  x: number;
  y: number;
}

export type Command =
  | { op: "M" | "L"; to: Point }
  | { op: "Q"; control: Point; to: Point }
  | { op: "C"; first: Point; second: Point; to: Point }
  | { op: "Z" };

const round2 = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const xy = (point: Point): string => `${round2(point.x)} ${round2(point.y)}`;

const identity = (point: Point): Point => point;

/** Serialises commands, mapping every point through `map` on the way. */
export const toPath = (
  commands: readonly Command[],
  map: (point: Point) => Point = identity
): string =>
  commands
    .map((command) => {
      switch (command.op) {
        case "M":
        case "L":
          return `${command.op}${xy(map(command.to))}`;
        case "Q":
          return `Q${xy(map(command.control))} ${xy(map(command.to))}`;
        case "C":
          return `C${xy(map(command.first))} ${xy(map(command.second))} ${xy(map(command.to))}`;
        default:
          return "Z";
      }
    })
    .join("");

/**
 * A polygon with each corner rounded by a quadratic through the corner itself.
 * A quadratic corner is a little squarer than a circular one, which is the
 * squircle look the mark is drawn with. `radii` gives one radius per vertex.
 */
export const roundedPolygon = (
  vertices: readonly Point[],
  radii: readonly number[]
): Command[] => {
  const commands: Command[] = [];
  const count = vertices.length;
  vertices.forEach((corner, index) => {
    const previous = vertices[(index - 1 + count) % count] ?? corner;
    const next = vertices[(index + 1) % count] ?? corner;
    const inX = previous.x - corner.x;
    const inY = previous.y - corner.y;
    const outX = next.x - corner.x;
    const outY = next.y - corner.y;
    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    const half =
      Math.acos(
        Math.min(
          Math.max((inX * outX + inY * outY) / (inLength * outLength), -1),
          1
        )
      ) / 2;
    const reach = Math.min(
      (radii[index] ?? 0) / Math.tan(half),
      inLength / 2.05,
      outLength / 2.05
    );
    const start: Point = {
      x: corner.x + (inX / inLength) * reach,
      y: corner.y + (inY / inLength) * reach,
    };
    const end: Point = {
      x: corner.x + (outX / outLength) * reach,
      y: corner.y + (outY / outLength) * reach,
    };
    commands.push({ op: index === 0 ? "M" : "L", to: start });
    commands.push({ op: "Q", control: corner, to: end });
  });
  commands.push({ op: "Z" });
  return commands;
};

/** Control-point offset that turns a cubic into a quarter circle. */
const KAPPA = 0.5523;

/**
 * A vertical pill — the shape of an open eye. Its caps are half ellipses as
 * wide as the pill and at most as tall as it is wide, so a pill squeezed
 * shorter than its width (a blink, a squint) becomes a flat ellipse.
 */
export const pill = (
  center: Point,
  width: number,
  height: number
): Command[] => {
  const rx = width / 2;
  const ry = Math.min(rx, Math.max(height / 2, 0.01));
  const straight = Math.max(height / 2 - ry, 0);
  const { x, y } = center;
  const top = y - straight - ry;
  const bottom = y + straight + ry;
  const left = x - rx;
  const right = x + rx;
  return [
    { op: "M", to: { x, y: top } },
    {
      op: "C",
      first: { x: x + rx * KAPPA, y: top },
      second: { x: right, y: y - straight - ry * KAPPA },
      to: { x: right, y: y - straight },
    },
    { op: "L", to: { x: right, y: y + straight } },
    {
      op: "C",
      first: { x: right, y: y + straight + ry * KAPPA },
      second: { x: x + rx * KAPPA, y: bottom },
      to: { x, y: bottom },
    },
    {
      op: "C",
      first: { x: x - rx * KAPPA, y: bottom },
      second: { x: left, y: y + straight + ry * KAPPA },
      to: { x: left, y: y + straight },
    },
    { op: "L", to: { x: left, y: y - straight } },
    {
      op: "C",
      first: { x: left, y: y - straight - ry * KAPPA },
      second: { x: x - rx * KAPPA, y: top },
      to: { x, y: top },
    },
    { op: "Z" },
  ];
};

/**
 * The open curve of a happy eye — an upturned arc, stroked rather than filled.
 * Proportions follow Open Bot Avatar: 0.72 of the eye's width either side, the
 * ends a tenth of its height below the centre, the control 0.42 above it.
 */
export const happyArc = (
  center: Point,
  width: number,
  height: number
): Command[] => [
  { op: "M", to: { x: center.x - width * 0.72, y: center.y + height * 0.1 } },
  {
    op: "Q",
    control: { x: center.x, y: center.y - height * 0.42 },
    to: { x: center.x + width * 0.72, y: center.y + height * 0.1 },
  },
];

/** An ellipse as four cubics, so it survives any affine map exactly. */
export const ellipse = (center: Point, rx: number, ry: number): Command[] => {
  const x = Math.max(rx, 0.01);
  const y = Math.max(ry, 0.01);
  const { x: cx, y: cy } = center;
  return [
    { op: "M", to: { x: cx, y: cy - y } },
    {
      op: "C",
      first: { x: cx + x * KAPPA, y: cy - y },
      second: { x: cx + x, y: cy - y * KAPPA },
      to: { x: cx + x, y: cy },
    },
    {
      op: "C",
      first: { x: cx + x, y: cy + y * KAPPA },
      second: { x: cx + x * KAPPA, y: cy + y },
      to: { x: cx, y: cy + y },
    },
    {
      op: "C",
      first: { x: cx - x * KAPPA, y: cy + y },
      second: { x: cx - x, y: cy + y * KAPPA },
      to: { x: cx - x, y: cy },
    },
    {
      op: "C",
      first: { x: cx - x, y: cy - y * KAPPA },
      second: { x: cx - x * KAPPA, y: cy - y },
      to: { x: cx, y: cy - y },
    },
    { op: "Z" },
  ];
};

/**
 * A four-pointed glint with concave sides — the sparkle of something shiny.
 * `turn` rotates it in radians.
 */
export const sparkle = (center: Point, size: number, turn = 0): Command[] => {
  const at = (angle: number, reach: number): Point => ({
    x: center.x + reach * Math.sin(angle + turn),
    y: center.y - reach * Math.cos(angle + turn),
  });
  const waist = size * 0.18;
  const tips = [0, 1, 2, 3].map((index) => at((index * Math.PI) / 2, size));
  const bends = [0, 1, 2, 3].map((index) =>
    at((index * Math.PI) / 2 + Math.PI / 4, waist)
  );
  const [first = center] = tips;
  return [
    { op: "M", to: first },
    ...tips.map((_, index): Command => ({
      op: "Q",
      control: bends[index] ?? center,
      to: tips[(index + 1) % tips.length] ?? center,
    })),
    { op: "Z" },
  ];
};
