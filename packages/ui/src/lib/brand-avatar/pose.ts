import { SLOT_LINE } from "./mark";
import { clamp, clamp01, lerp, smoothstep } from "./math";

/**
 * A pose is the avatar's complete appearance at one instant, as numbers, in
 * Open Bot Avatar's vocabulary: how the head is turned, tilted, lifted and
 * squashed, and where and how the two eyes look. `states.ts` produces one for
 * a moment in time; `engine.ts` blends the one being left into the one being
 * entered.
 */
export interface Pose {
  /** Turn about the vertical axis, in radians; negative faces the viewer's left. */
  yaw: number;
  /** Turn about the horizontal axis, in radians; positive faces up. */
  pitch: number;
  /** Tilt in the picture plane, in degrees, clockwise. */
  roll: number;
  /** Vertical offset in units; negative is up. */
  lift: number;
  /** Horizontal and vertical scale about the base — squash and stretch. */
  sx: number;
  sy: number;
  /** Where the eyes look, -1..1 per axis; positive is right and down. */
  gazeX: number;
  gazeY: number;
  /** Eyelid closure, 0 open to 1 shut. */
  blink: number;
  /** Per-eye narrowing, 0..1; negative opens the eye wider. */
  squintL: number;
  squintR: number;
  /** 1 draws the eye as a happy arc, 0 as a pill. Never fractional. */
  happyL: number;
  happyR: number;
  /** Fades both eyes together; the mark has none. */
  eyes: number;
  /** The coin being saved: it falls into the slot and is cut off at its line. */
  drop: CoinPose;
  /** Coins in the open — tossed out of the slot, or flipped above the head. */
  coins: CoinPose[];
  /** Glints around the head when there is money about. */
  sparks: SparkPose[];
  /** A highlight sweeping across the head, as across polished metal. */
  shine: ShinePose;
}

/** A coin in head space, so it hops and turns with the head. */
export type CoinPose = {
  x: number;
  y: number;
  /** Face-on width as a share of its height: 1 face-on, near 0 edge-on. */
  width: number;
  opacity: number;
};

export type SparkPose = {
  x: number;
  y: number;
  /** Tip-to-centre reach; 0 hides the glint. */
  size: number;
  turn: number;
};

export type ShinePose = {
  /** Where the band crosses the head, -1 (left edge) to 1 (right edge). */
  at: number;
  opacity: number;
};

/** The number of open coins a pose carries, always. */
export const OPEN_COINS = 3;

/** A coin waiting, unseen, inside the slot. */
export const restCoin = (): CoinPose => ({
  x: 50,
  y: SLOT_LINE,
  width: 1,
  opacity: 0,
});

/**
 * Where the glints sit when there are any — around the ears and the cheeks —
 * and so how many a pose carries, always.
 */
const SPARK_SPOTS: readonly [number, number][] = [
  [8, 10],
  [93, 22],
  [96, 74],
  [5, 66],
];

const restSparks = (): SparkPose[] =>
  SPARK_SPOTS.map(([x, y]) => ({ x, y, size: 0, turn: 0 }));

/** Open Bot Avatar's resting turn: a little to the left and a little up. */
export const REST_YAW = -0.3;
export const REST_PITCH = 0.2;

/** The Freenary mark: the bare head, square to the viewer, no eyes. */
export const markPose = (): Pose => ({
  yaw: 0,
  pitch: 0,
  roll: 0,
  lift: 0,
  sx: 1,
  sy: 1,
  gazeX: 0,
  gazeY: 0,
  blink: 0,
  squintL: 0,
  squintR: 0,
  happyL: 0,
  happyR: 0,
  eyes: 0,
  drop: restCoin(),
  coins: Array.from({ length: OPEN_COINS }, restCoin),
  sparks: restSparks(),
  shine: { at: -1, opacity: 0 },
});

/** The agent at rest: the same head, turned, with its eyes open. */
export const agentPose = (): Pose => ({
  ...markPose(),
  yaw: REST_YAW,
  pitch: REST_PITCH,
  eyes: 1,
});

/** Below this a coin is not on screen, so where it was does not matter. */
const HIDDEN = 0.01;

/**
 * Coins never slide between two states' positions. A hidden coin fades in
 * where the state wants it — sliding it would make a dropped coin rise out of
 * the slot before it falls in. A visible one fades out where it was over the
 * first half of the blend, and the state's coin fades in over the second, so
 * the swap happens at zero opacity. The choice reads only the source coin,
 * which a transition holds still, so it cannot flip mid-blend.
 */
const blendCoin = (from: CoinPose, to: CoinPose, w: number): CoinPose => {
  if (from.opacity <= HIDDEN) {
    return { ...to, opacity: lerp(from.opacity, to.opacity, w) };
  }
  return w < 0.5
    ? { ...from, opacity: from.opacity * (1 - 2 * w) }
    : { ...to, opacity: to.opacity * (2 * w - 1) };
};

const blendSpark = (from: SparkPose, to: SparkPose, w: number): SparkPose => ({
  x: lerp(from.x, to.x, w),
  y: lerp(from.y, to.y, w),
  size: lerp(from.size, to.size, w),
  turn: lerp(from.turn, to.turn, w),
});

/**
 * Blends two poses. Everything is a plain lerp except two things that cannot
 * be halfway: the eye shape, which switches at the midpoint behind a blink,
 * and the coins, which fade rather than slide (see `blendCoin`).
 */
export const blendPose = (from: Pose, to: Pose, weight: number): Pose => {
  const w = clamp01(weight);
  const swap = 1 - Math.abs(2 * w - 1);
  const shapeChanges = from.happyL !== to.happyL || from.happyR !== to.happyR;
  return {
    yaw: lerp(from.yaw, to.yaw, w),
    pitch: lerp(from.pitch, to.pitch, w),
    roll: lerp(from.roll, to.roll, w),
    lift: lerp(from.lift, to.lift, w),
    sx: lerp(from.sx, to.sx, w),
    sy: lerp(from.sy, to.sy, w),
    gazeX: lerp(from.gazeX, to.gazeX, w),
    gazeY: lerp(from.gazeY, to.gazeY, w),
    blink: shapeChanges
      ? Math.max(lerp(from.blink, to.blink, w), swap)
      : lerp(from.blink, to.blink, w),
    squintL: lerp(from.squintL, to.squintL, w),
    squintR: lerp(from.squintR, to.squintR, w),
    happyL: w < 0.5 ? from.happyL : to.happyL,
    happyR: w < 0.5 ? from.happyR : to.happyR,
    eyes: lerp(from.eyes, to.eyes, w),
    drop: blendCoin(from.drop, to.drop, w),
    coins: to.coins.map((coin, index) =>
      blendCoin(from.coins[index] ?? coin, coin, w)
    ),
    sparks: to.sparks.map((spark, index) =>
      blendSpark(from.sparks[index] ?? spark, spark, w)
    ),
    shine: {
      at: lerp(from.shine.at, to.shine.at, w),
      opacity: lerp(from.shine.opacity, to.shine.opacity, w),
    },
  };
};

/** Where the pointer is, relative to the avatar, plus how much it counts. */
export type Gaze = { x: number; y: number; weight: number };

const FOLLOW_GAZE = 0.7;
const FOLLOW_YAW = 0.32;
const FOLLOW_PITCH = 0.18;

/**
 * Turns the head and the eyes toward the pointer, the way Open Bot Avatar's
 * cursor following does: pill eyes look most of the way there, and the head
 * turns from its resting angle toward it. Happy arcs have no pupil to aim.
 */
export const attend = (pose: Pose, gaze: Gaze | undefined): Pose => {
  if (!gaze || gaze.weight <= 0 || pose.eyes <= 0) {
    return pose;
  }
  const weight = smoothstep(gaze.weight);
  const x = clamp(gaze.x, -1, 1);
  const y = clamp(gaze.y, -1, 1);
  const pills = pose.happyL === 0 && pose.happyR === 0;
  return {
    ...pose,
    gazeX: pills ? lerp(pose.gazeX, x * FOLLOW_GAZE, weight) : pose.gazeX,
    gazeY: pills ? lerp(pose.gazeY, y * FOLLOW_GAZE, weight) : pose.gazeY,
    yaw: pose.yaw + weight * (x * FOLLOW_YAW - REST_YAW) * pose.eyes,
    pitch:
      pose.pitch + weight * (-y * FOLLOW_PITCH - REST_PITCH / 2) * pose.eyes,
  };
};

const MIN_SCALE = 0.4;
const MAX_TURN = 1.2;

/**
 * Keeps a pose drawable: a turn past ~70 degrees would fold the head edge-on,
 * and a squash past the minimum would invert it.
 */
export const normalizePose = (pose: Pose): Pose => ({
  ...pose,
  yaw: clamp(pose.yaw, -MAX_TURN, MAX_TURN),
  pitch: clamp(pose.pitch, -MAX_TURN, MAX_TURN),
  sx: Math.max(pose.sx, MIN_SCALE),
  sy: Math.max(pose.sy, MIN_SCALE),
  blink: clamp01(pose.blink),
  squintL: clamp(pose.squintL, -0.5, 1),
  squintR: clamp(pose.squintR, -0.5, 1),
  eyes: clamp01(pose.eyes),
  drop: { ...pose.drop, opacity: clamp01(pose.drop.opacity) },
  coins: pose.coins.map((coin) => ({
    ...coin,
    opacity: clamp01(coin.opacity),
  })),
  sparks: pose.sparks.map((spark) => ({
    ...spark,
    size: Math.max(spark.size, 0),
  })),
  shine: { ...pose.shine, opacity: clamp01(pose.shine.opacity) },
});
