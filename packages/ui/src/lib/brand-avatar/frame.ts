import {
  BASE,
  COIN_RADIUS,
  EYE_DEPTH,
  EYE_HEIGHT,
  EYE_SPACING,
  EYE_WIDTH,
  EYE_Y,
  GAZE_X,
  GAZE_Y,
  HALF_DEPTH,
  HEAD,
  NOSTRIL_GAP,
  NOSTRIL_RX,
  NOSTRIL_RY,
  PIVOT,
  SLOT,
  SLOT_LINE,
  SNOUT_CENTER,
  SNOUT_DEPTH,
} from "./mark";
import { DEG } from "./math";
import type { CoinPose, Pose, ShinePose, SparkPose } from "./pose";
import {
  type Command,
  ellipse,
  happyArc,
  pill,
  type Point,
  roundedPolygon,
  sparkle,
  toPath,
} from "./shape";

export {
  COIN_COLOR,
  COIN_MARK_COLOR,
  EYE_INK,
  MARK_COLOR,
  SHINE_COLOR,
  SPARK_COLOR,
  VIEW_BOX_SIZE,
} from "./mark";

/**
 * Turns a pose into the exact paths a renderer draws. The slot list is fixed
 * and ordered, so a renderer mounts the elements once and then only patches
 * `d` and `opacity` — no reconciliation while the avatar animates.
 *
 * The head is drawn as a stack of copies from its back face to its front face,
 * slid apart along the turn; their union is the silhouette of a solid slab
 * seen at that angle, sides included. Every copy winds the same way, so one
 * path under the default `nonzero` rule fills the union. The coin slot is a
 * hole through the whole slab, so a renderer cuts it out with a mask rather
 * than filling it.
 */

export const EYE_SLOTS = [
  "eye-left",
  "eye-right",
  "arc-left",
  "arc-right",
] as const;

export type EyeSlot = (typeof EYE_SLOTS)[number];

/** Pills are filled; happy arcs are stroked. Neither style ever animates. */
export const EYE_STROKE_WIDTH = EYE_WIDTH * 0.6;
export const EYE_STYLES: Record<EyeSlot, "fill" | "stroke"> = {
  "eye-left": "fill",
  "eye-right": "fill",
  "arc-left": "stroke",
  "arc-right": "stroke",
};

export type EyeDraw = {
  slot: EyeSlot;
  d: string;
  opacity: number;
};

export type Draw = { d: string; opacity: number };

/** A coin is a gold disc plus a darker ring, faded together. */
export type CoinDraw = { disc: string; ring: string; opacity: number };

export type AvatarFrame = {
  /** The whole slab: every depth layer, back to front, in one path. */
  body: string;
  /** The front face alone — the mark itself when the head is square on. */
  front: string;
  slot: string;
  /** The agent's two nostrils, faded with the eyes. */
  nose: Draw;
  /** A band of light, to be clipped to `front`. */
  shine: Draw;
  /** Everything above the slot's line: the falling coin is clipped to it. */
  coinClip: string;
  drop: CoinDraw;
  /** Same length and order as the pose's open coins. */
  coins: CoinDraw[];
  /** Same length and order as the pose's sparks. */
  sparks: Draw[];
  /** Same length and order as `EYE_SLOTS`. */
  eyes: EyeDraw[];
};

const EMPTY = "";

/**
 * Maps a point on a plane `depth` units in front of the head's middle into
 * the viewBox under a pose: squash about the base, foreshorten and slide with
 * the turn, tilt about the pivot, then lift.
 */
const projection = (pose: Pose, depth: number) => {
  const cosYaw = Math.cos(pose.yaw);
  const cosPitch = Math.cos(pose.pitch);
  const slideX = depth * Math.sin(pose.yaw);
  const slideY = -depth * Math.sin(pose.pitch);
  const sin = Math.sin(pose.roll * DEG);
  const cos = Math.cos(pose.roll * DEG);
  return (point: Point): Point => {
    const x = BASE.x + (point.x - BASE.x) * pose.sx * cosYaw + slideX;
    const y = BASE.y + (point.y - BASE.y) * pose.sy * cosPitch + slideY;
    const dx = x - PIVOT.x;
    const dy = y - PIVOT.y;
    return {
      x: PIVOT.x + dx * cos - dy * sin,
      y: PIVOT.y + dx * sin + dy * cos + pose.lift,
    };
  };
};

/**
 * Open Bot Avatar's eyelid: a blink or a squint shortens the pill, never below
 * a little over half its width, and it closes toward a point slightly below
 * its middle.
 */
const eyeOpening = (blink: number, squint: number): number =>
  Math.max(
    EYE_HEIGHT * Math.max(0.09, (1 - blink) * (1 - squint * 0.4)),
    EYE_WIDTH * 0.55
  );

const buildEyes = (pose: Pose): EyeDraw[] => {
  const map = projection(pose, EYE_DEPTH);
  const centers = [-1, 1].map((side): Point => ({
    x: 50 + (side * EYE_SPACING) / 2 + pose.gazeX * GAZE_X,
    y: EYE_Y + pose.gazeY * GAZE_Y,
  }));
  const squints = [pose.squintL, pose.squintR];
  const happy = [pose.happyL, pose.happyR];
  const visible = pose.eyes > 0.002;

  const pills = centers.map((center, index): EyeDraw => {
    const opacity = pose.eyes * (1 - (happy[index] ?? 0));
    const open = eyeOpening(pose.blink, squints[index] ?? 0);
    const lowered = { x: center.x, y: center.y + (EYE_HEIGHT - open) * 0.18 };
    return {
      slot: index === 0 ? "eye-left" : "eye-right",
      d:
        visible && opacity > 0.002
          ? toPath(pill(lowered, EYE_WIDTH, open), map)
          : EMPTY,
      opacity,
    };
  });

  const arcs = centers.map((center, index): EyeDraw => {
    const opacity = pose.eyes * (happy[index] ?? 0);
    return {
      slot: index === 0 ? "arc-left" : "arc-right",
      d:
        visible && opacity > 0.002
          ? toPath(happyArc(center, EYE_WIDTH, EYE_HEIGHT), map)
          : EMPTY,
      opacity,
    };
  });

  return [...pills, ...arcs];
};

/** Coins ride a little in front of the face, so a turn never hides them. */
const COIN_DEPTH = HALF_DEPTH + 3;
const RING_OUTER = 0.66;
const RING_INNER = 0.48;
const VISIBLE = 0.002;

const buildCoin = (coin: CoinPose, map: (point: Point) => Point): CoinDraw => {
  if (coin.opacity <= VISIBLE) {
    return { disc: EMPTY, ring: EMPTY, opacity: 0 };
  }
  const center = { x: coin.x, y: coin.y };
  const rx = COIN_RADIUS * Math.max(coin.width, 0.06);
  return {
    disc: toPath(ellipse(center, rx, COIN_RADIUS), map),
    ring:
      toPath(ellipse(center, rx * RING_OUTER, COIN_RADIUS * RING_OUTER), map) +
      toPath(ellipse(center, rx * RING_INNER, COIN_RADIUS * RING_INNER), map),
    opacity: coin.opacity,
  };
};

const buildSpark = (spark: SparkPose, map: (point: Point) => Point): Draw =>
  spark.size <= 0.05
    ? { d: EMPTY, opacity: 0 }
    : {
        d: toPath(
          sparkle({ x: spark.x, y: spark.y }, spark.size, spark.turn),
          map
        ),
        opacity: 1,
      };

const SHINE_HALF_WIDTH = 6;
const SHINE_SLANT = 0.4;

/** A slanted band of light whose middle crosses the head at `shine.at`. */
const buildShine = (shine: ShinePose, map: (point: Point) => Point): Draw => {
  if (shine.opacity <= VISIBLE) {
    return { d: EMPTY, opacity: 0 };
  }
  const centerAt = (y: number) => 50 + shine.at * 50 + SHINE_SLANT * (y - 50);
  const top = centerAt(0);
  const bottom = centerAt(100);
  const band: Command[] = [
    { op: "M", to: { x: top - SHINE_HALF_WIDTH, y: 0 } },
    { op: "L", to: { x: top + SHINE_HALF_WIDTH, y: 0 } },
    { op: "L", to: { x: bottom + SHINE_HALF_WIDTH, y: 100 } },
    { op: "L", to: { x: bottom - SHINE_HALF_WIDTH, y: 100 } },
    { op: "Z" },
  ];
  return { d: toPath(band, map), opacity: shine.opacity };
};

const ABOVE_SLOT: readonly Command[] = roundedPolygon(
  [
    { x: -100, y: -200 },
    { x: 200, y: -200 },
    { x: 200, y: SLOT_LINE },
    { x: -100, y: SLOT_LINE },
  ],
  [0, 0, 0, 0]
);

const NOSE: readonly Command[] = [
  ...[-1, 1].flatMap((side) =>
    ellipse(
      { x: SNOUT_CENTER.x + side * NOSTRIL_GAP, y: SNOUT_CENTER.y },
      NOSTRIL_RX,
      NOSTRIL_RY
    )
  ),
];

const buildNose = (pose: Pose): Draw =>
  pose.eyes <= VISIBLE
    ? { d: EMPTY, opacity: 0 }
    : { d: toPath(NOSE, projection(pose, SNOUT_DEPTH)), opacity: pose.eyes };

/**
 * Depth layers in the slab. At the widest turn the faces sit about eight units
 * apart, so nine layers leave under a unit between neighbours — no visible
 * step along the sides.
 */
const DEPTH_LAYERS = 9;

/** How far the two faces may drift apart before the slab needs its layers. */
const FLAT_SLIDE = 0.05;

export const poseToFrame = (pose: Pose): AvatarFrame => {
  const front = toPath(HEAD, projection(pose, HALF_DEPTH));
  const slide =
    2 * HALF_DEPTH * Math.hypot(Math.sin(pose.yaw), Math.sin(pose.pitch));
  const layers =
    slide < FLAT_SLIDE
      ? [front]
      : Array.from({ length: DEPTH_LAYERS }, (_, index) =>
          toPath(
            HEAD,
            projection(
              pose,
              -HALF_DEPTH + (2 * HALF_DEPTH * index) / (DEPTH_LAYERS - 1)
            )
          )
        );
  const face = projection(pose, HALF_DEPTH);
  const coins = projection(pose, COIN_DEPTH);
  return {
    body: layers.join(""),
    front,
    slot: toPath(SLOT, face),
    nose: buildNose(pose),
    eyes: buildEyes(pose),
    shine: buildShine(pose.shine, face),
    coinClip: toPath(ABOVE_SLOT, face),
    drop: buildCoin(pose.drop, coins),
    coins: pose.coins.map((coin) => buildCoin(coin, coins)),
    sparks: pose.sparks.map((spark) => buildSpark(spark, coins)),
  };
};
