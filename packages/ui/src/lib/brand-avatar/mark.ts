import { type Command, type Point, roundedPolygon } from "./shape";

/**
 * The Freenary mark, in the 100-unit viewBox: a pink squircle piggy bank head
 * whose two top corners rise into ears, with the coin slot cut through it.
 * The agent adds Open Bot Avatar eyes and an ink snout on top of exactly this,
 * and gold coins and glints for its money moments.
 */

export const VIEW_BOX_SIZE = 100;

export const MARK_COLOR = "#ff6fa5";
/** Open Bot Avatar's eye ink, also the snout's, kept in every theme because it sits on pink. */
export const EYE_INK = "#151515";
export const COIN_COLOR = "#ffc23d";
export const COIN_MARK_COLOR = "#e8961a";
export const SPARK_COLOR = "#ffb71b";
export const SHINE_COLOR = "#ffffff";

/** Clockwise from the left ear's outer foot. */
const HEAD_VERTICES: readonly Point[] = [
  { x: 10, y: 40 },
  { x: 14, y: 6 },
  { x: 38, y: 20 },
  { x: 62, y: 20 },
  { x: 86, y: 6 },
  { x: 90, y: 40 },
  { x: 90, y: 92 },
  { x: 10, y: 92 },
];
const HEAD_RADII = [8, 6, 4, 4, 6, 8, 20, 20] as const;

export const HEAD: readonly Command[] = roundedPolygon(
  HEAD_VERTICES,
  HEAD_RADII
);

const SLOT_TOP = 25;
const SLOT_HEIGHT = 9;
const SLOT_HALF_WIDTH = 17;

export const SLOT: readonly Command[] = roundedPolygon(
  [
    { x: 50 - SLOT_HALF_WIDTH, y: SLOT_TOP },
    { x: 50 + SLOT_HALF_WIDTH, y: SLOT_TOP },
    { x: 50 + SLOT_HALF_WIDTH, y: SLOT_TOP + SLOT_HEIGHT },
    { x: 50 - SLOT_HALF_WIDTH, y: SLOT_TOP + SLOT_HEIGHT },
  ],
  [4.5, 4.5, 4.5, 4.5]
);

/** Where a dropped coin crosses into the slot, and disappears. */
export const SLOT_LINE = SLOT_TOP + SLOT_HEIGHT / 2;

/**
 * The agent's snout: two ink nostrils below the eyes, sized to them. The logo
 * has none.
 */
export const SNOUT_CENTER: Point = { x: 50, y: 68 };
export const NOSTRIL_GAP = 6.5;
export const NOSTRIL_RX = 3.2;
export const NOSTRIL_RY = 4.6;
/**
 * The snout stands proud of the face, so it slides further than the eyes when
 * the head turns — the one cue that the face is not flat.
 */
export const SNOUT_DEPTH = 21;

/** A coin's radius, as drawn face-on. */
export const COIN_RADIUS = 11;

/** The squash anchor: the middle of the flat base the head stands on. */
export const BASE: Point = { x: 50, y: 92 };
/** The tilt pivot, a little below the middle of the head. */
export const PIVOT: Point = { x: 50, y: 60 };

/**
 * Half the head's thickness. The head turns as a slab: its front and back
 * faces slide apart by this much times the turn, which widens the silhouette
 * the way a solid object's does.
 */
export const HALF_DEPTH = 7;
/**
 * How far in front of the middle the eyes sit. Larger than `HALF_DEPTH` because
 * the face is read as a rounded surface, so the eyes travel further than the
 * outline when the head turns.
 */
export const EYE_DEPTH = 16;

/**
 * The eyes, sized by Open Bot Avatar's contract — a 4 × 11 pill at scale 1 —
 * at the scale its renderer reaches on a body this large.
 */
export const EYE_SCALE = 1.5;
export const EYE_WIDTH = 4 * EYE_SCALE;
export const EYE_HEIGHT = 11 * EYE_SCALE;
export const EYE_Y = 46.5;
export const EYE_SPACING = 24;
/** Gaze travel in units per unit of gaze, as Open Bot Avatar scales it. */
export const GAZE_X = 1.5 * EYE_SCALE;
export const GAZE_Y = 1.1 * EYE_SCALE;
