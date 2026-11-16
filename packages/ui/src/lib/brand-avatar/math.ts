/**
 * Time-independent scalar helpers for the brand avatar. Every function here is
 * pure and clock-free so a frame can be reproduced from `(state, time, seed)`
 * alone.
 *
 * The blink schedule, the gaze saccades and the hash behind them follow the
 * Open Bot Avatar renderer (https://dominikscholz.github.io/open-bot-avatar/),
 * whose eyes and motion this avatar reuses.
 */

export const TAU = Math.PI * 2;
export const DEG = TAU / 360;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const lerp = (from: number, to: number, weight: number): number =>
  from + (to - from) * weight;

/** Hermite ease in 0..1 — the curve every blend and saccade uses. */
export const smoothstep = (value: number): number => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

/** Signed oscillation in -1..1 with a period of `seconds`. */
export const cycle = (time: number, seconds: number, phase = 0): number =>
  Math.sin((TAU * time) / seconds + phase);

/** Deterministic 0..1 value for a seed and an integer key. */
export const hash01 = (seed: number, key: number): number => {
  let value = (seed ^ Math.imul(key | 0, 2_654_435_761)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2_246_822_507);
  value = Math.imul(value ^ (value >>> 13), 3_266_489_909);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
};

/** A stable 32-bit seed for a string, so each avatar blinks on its own beat. */
export const seedOf = (text: string): number => {
  let value = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16_777_619);
  }
  return value >>> 0;
};

const BLINK_PERIOD = 4.2;
const BLINK_SECONDS = 0.19;
const DOUBLE_BLINK_GAP = 0.34;
const DOUBLE_BLINK_CHANCE = 0.2;

/**
 * Eyelid closure in 0..1 (1 = shut). One blink lands somewhere in every
 * 4.2-second window, and one window in five blinks twice.
 */
export const blinkAt = (seed: number, time: number): number => {
  const window = Math.floor(time / BLINK_PERIOD);
  let closure = 0;
  for (const index of [window - 1, window]) {
    const start = index * BLINK_PERIOD + 0.5 + hash01(seed, index * 2) * 2.9;
    const starts =
      hash01(seed, index * 2 + 1) > 1 - DOUBLE_BLINK_CHANCE
        ? [start, start + DOUBLE_BLINK_GAP]
        : [start];
    for (const at of starts) {
      const progress = (time - at) / BLINK_SECONDS;
      if (progress > 0 && progress < 1) {
        closure = Math.max(closure, Math.sin(Math.PI * progress));
      }
    }
  }
  return closure;
};

const SACCADE_PERIOD = 1.9;
const SACCADE_SECONDS = 0.16;
const CENTERED_CHANCE = 0.4;

const saccadeTarget = (seed: number, index: number): [number, number] =>
  hash01(seed, 1000 + index * 3) < CENTERED_CHANCE
    ? [0, 0]
    : [
        (hash01(seed, 1001 + index * 3) * 2 - 1) * 0.6,
        (hash01(seed, 1002 + index * 3) * 2 - 1) * 0.35,
      ];

/**
 * Where idle eyes look, in -1..1 per axis. Every 1.9 seconds they jump to a
 * new spot — straight ahead two times in five — in a quick eased move.
 */
export const saccadeAt = (seed: number, time: number): [number, number] => {
  const index = Math.floor(time / SACCADE_PERIOD);
  const [fromX, fromY] = saccadeTarget(seed, index - 1);
  const [toX, toY] = saccadeTarget(seed, index);
  const weight = smoothstep((time - index * SACCADE_PERIOD) / SACCADE_SECONDS);
  return [lerp(fromX, toX, weight), lerp(fromY, toY, weight)];
};
