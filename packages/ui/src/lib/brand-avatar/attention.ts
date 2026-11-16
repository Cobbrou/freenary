import type { Gaze } from "./pose";

/**
 * Cursor following, ported from Open Bot Avatar. The pointer's offset from the
 * avatar is squashed into -1..1 with `tanh`, so a far pointer pins the gaze at
 * the edge instead of throwing it off the face, and the eyes ease toward it —
 * quickly while the pointer is around, slowly back to rest once it leaves.
 */

export type Attention = { x: number; y: number; attention: number };

export const RESTING_ATTENTION: Attention = { x: 0, y: 0, attention: 0 };

/** The smallest distance the offset is measured against, in CSS pixels. */
const MIN_REACH = 160;
const FOLLOW_SECONDS = 0.12;
const RELEASE_SECONDS = 0.3;
/** A frame gap longer than this is a stalled tab, not motion to catch up on. */
const MAX_STEP = 0.1;

export type Box = { left: number; top: number; width: number; height: number };

/** Where a pointer sits relative to a box's centre, in -1..1 per axis. */
export const pointerOffset = (
  pointer: { x: number; y: number },
  box: Box
): { x: number; y: number } => {
  const reach = Math.max(box.width, box.height, MIN_REACH);
  const x = (pointer.x - (box.left + box.width / 2)) / reach;
  const y = (pointer.y - (box.top + box.height / 2)) / reach;
  const distance = Math.hypot(x, y);
  if (!Number.isFinite(distance) || distance < 1e-9) {
    return { x: 0, y: 0 };
  }
  const squash = Math.tanh(distance) / distance;
  return { x: x * squash, y: y * squash };
};

/** Eases the attention toward `target` — or back to rest when it is `null`. */
export const stepAttention = (
  state: Attention,
  target: { x: number; y: number } | null,
  seconds: number
): Attention => {
  const goal = target ? { ...target, attention: 1 } : RESTING_ATTENTION;
  const dt = Math.max(0, Math.min(seconds, MAX_STEP));
  const ease = (constant: number) => 1 - Math.exp(-dt / constant);
  const move = ease(target ? FOLLOW_SECONDS : RELEASE_SECONDS);
  return {
    x: state.x + (goal.x - state.x) * move,
    y: state.y + (goal.y - state.y) * move,
    attention:
      state.attention +
      (goal.attention - state.attention) * ease(RELEASE_SECONDS),
  };
};

export const attentionGaze = (state: Attention): Gaze | undefined =>
  state.attention > 0
    ? { x: state.x, y: state.y, weight: Math.min(1, state.attention) }
    : undefined;
