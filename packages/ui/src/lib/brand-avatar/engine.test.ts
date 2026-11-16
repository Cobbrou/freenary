/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

import {
  attentionGaze,
  pointerOffset,
  RESTING_ATTENTION,
  stepAttention,
} from "./attention";
import { brandAvatarFrame, createBrandAvatarEngine } from "./engine";
import { type AvatarFrame, EYE_SLOTS, poseToFrame } from "./frame";
import { COIN_RADIUS, SLOT_LINE } from "./mark";
import { blinkAt, saccadeAt } from "./math";
import {
  agentPose,
  attend,
  blendPose,
  markPose,
  normalizePose,
  REST_YAW,
} from "./pose";
import { BRAND_AVATAR_STATES, statePose, TRANSITION_SECONDS } from "./states";

/** Every moment a viewer could land on, including one long after mount. */
const MOMENTS = [0, 0.07, 0.31, 0.5, 1.3, 2.9, 4.2, 17.6, 61.4];
const SEEDS = [0, 7, 123_456];

const numbersIn = (frame: AvatarFrame): string =>
  [
    frame.body,
    frame.front,
    frame.slot,
    frame.nose.d,
    frame.coinClip,
    frame.shine.d,
    frame.drop.disc,
    frame.drop.ring,
    ...frame.coins.flatMap((coin) => [coin.disc, coin.ring]),
    ...frame.sparks.map((spark) => spark.d),
    ...frame.eyes.map((eye) => eye.d),
  ].join(" ");

const settledFrame = (
  state: (typeof BRAND_AVATAR_STATES)[number],
  time: number,
  age: number
): AvatarFrame =>
  poseToFrame(normalizePose(statePose(state, { time, age, seed: 0 })));

describe("brand avatar geometry", () => {
  test("every state renders finite paths at any moment and seed", () => {
    for (const state of BRAND_AVATAR_STATES) {
      for (const time of MOMENTS) {
        for (const seed of SEEDS) {
          const frame = brandAvatarFrame(state, time, seed);
          expect(numbersIn(frame)).not.toMatch(/NaN|Infinity|undefined/);
          expect(frame.body.length).toBeGreaterThan(0);
          expect(frame.slot.length).toBeGreaterThan(0);
          for (const eye of frame.eyes) {
            expect(eye.opacity).toBeGreaterThanOrEqual(0);
            expect(eye.opacity).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  test("the eye list covers every slot once, in order", () => {
    const slots = brandAvatarFrame("happy", 1).eyes.map((eye) => eye.slot);
    expect(slots).toEqual([...EYE_SLOTS]);
  });

  test("the logo is the bare mark: still, square on, no eyes, snout or props", () => {
    const first = brandAvatarFrame("logo", 0);
    for (const time of MOMENTS) {
      for (const seed of SEEDS) {
        expect(brandAvatarFrame("logo", time, seed)).toEqual(first);
      }
    }
    expect(first.body).toBe(first.front);
    expect(first.nose).toEqual({ d: "", opacity: 0 });
    expect(first.shine.d).toBe("");
    expect(first.drop.disc).toBe("");
    for (const coin of first.coins) {
      expect(coin.disc).toBe("");
    }
    for (const spark of first.sparks) {
      expect(spark.d).toBe("");
    }
    for (const eye of first.eyes) {
      expect(eye.d).toBe("");
      expect(eye.opacity).toBe(0);
    }
  });

  test("every agent state shows its eyes", () => {
    for (const state of BRAND_AVATAR_STATES.filter((name) => name !== "logo")) {
      const frame = brandAvatarFrame(state, 1.3);
      expect(frame.eyes.some((eye) => eye.d && eye.opacity > 0)).toBe(true);
    }
  });

  test("a blend of any two states renders finite geometry and whole eye shapes", () => {
    for (const from of BRAND_AVATAR_STATES) {
      for (const to of BRAND_AVATAR_STATES) {
        for (const weight of [0.02, 0.19, 0.5, 0.81, 0.98]) {
          const pose = normalizePose(
            blendPose(
              statePose(from, { time: 0.4, age: 0.4, seed: 0 }),
              statePose(to, { time: 0.4, age: 0.4, seed: 0 }),
              weight
            )
          );
          expect([0, 1]).toContain(pose.happyL);
          expect([0, 1]).toContain(pose.happyR);
          expect(numbersIn(poseToFrame(pose))).not.toMatch(
            /NaN|Infinity|undefined/
          );
        }
      }
    }
  });

  test("a change of eye shape happens behind a closed eyelid", () => {
    const pill = agentPose();
    const arc = { ...agentPose(), happyL: 1, happyR: 1 };
    const halfway = blendPose(pill, arc, 0.5);
    expect(halfway.blink).toBe(1);
    expect(blendPose(pill, arc, 0.49).happyL).toBe(0);
    expect(blendPose(pill, arc, 0.51).happyL).toBe(1);
  });

  test("a pose pushed out of range is pulled back into a drawable one", () => {
    const fixed = normalizePose({
      ...agentPose(),
      yaw: 9,
      pitch: -9,
      sx: -1,
      sy: 0,
      blink: 3,
      squintL: 5,
      squintR: -5,
      eyes: 2,
    });
    expect(Math.abs(fixed.yaw)).toBeLessThan(Math.PI / 2);
    expect(Math.abs(fixed.pitch)).toBeLessThan(Math.PI / 2);
    expect(fixed.sx).toBeGreaterThan(0);
    expect(fixed.sy).toBeGreaterThan(0);
    expect(fixed.blink).toBe(1);
    expect(fixed.squintL).toBeLessThanOrEqual(1);
    expect(fixed.squintR).toBeGreaterThanOrEqual(-0.5);
    expect(fixed.eyes).toBe(1);
  });
});

describe("brand avatar money moments", () => {
  const dropAt = (state: "saving" | "success", time: number, age: number) =>
    statePose(state, { time, age, seed: 0 }).drop;

  test("success drops one coin, edge-on, through the slot, and keeps it", () => {
    const falling = dropAt("success", 0.2, 0.2);
    expect(falling.opacity).toBeGreaterThan(0.9);
    expect(falling.y).toBeLessThan(SLOT_LINE);
    expect(falling.width).toBeCloseTo(1, 1);

    const entering = dropAt("success", 0.5, 0.5);
    expect(Math.abs(entering.y - SLOT_LINE)).toBeLessThan(COIN_RADIUS);
    expect(entering.width).toBeLessThan(0.5);

    for (const age of [0.7, 2, 9]) {
      expect(dropAt("success", age, age).opacity).toBe(0);
    }
  });

  test("saving keeps dropping coins, one at a time", () => {
    const visible = Array.from(
      { length: 400 },
      (_, step) => dropAt("saving", step / 50, step / 50).opacity > 0.5
    );
    const starts = visible.filter(
      (shown, index) => shown && !visible[index - 1]
    ).length;
    expect(starts).toBeGreaterThanOrEqual(4);
    expect(visible.some((shown) => !shown)).toBe(true);
  });

  test("rich and celebrating toss coins and throw glints", () => {
    for (const state of ["rich", "celebrating"] as const) {
      const frame = brandAvatarFrame(state, 0.9, 5);
      expect(frame.coins.some((coin) => coin.opacity > 0.3)).toBe(true);
      expect(frame.sparks.some((spark) => spark.d)).toBe(true);
    }
  });

  test("loading flips a coin above the head while the eyes follow it", () => {
    const pose = statePose("loading", { time: 1, age: 1, seed: 0 });
    const [coin] = pose.coins;
    expect(coin?.opacity).toBe(1);
    expect(coin?.y).toBeLessThan(6);
    expect(pose.gazeY).toBeLessThan(-0.5);
  });
});

describe("brand avatar continuity", () => {
  const STEP = 1 / 240;

  test("no state jumps from one frame to the next", () => {
    for (const state of BRAND_AVATAR_STATES) {
      let previous = statePose(state, { time: 0, age: 0, seed: 3 });
      for (let step = 1; step <= 240 * 6; step += 1) {
        const time = step * STEP;
        const pose = statePose(state, { time, age: time, seed: 3 });
        expect(Math.abs(pose.gazeX - previous.gazeX)).toBeLessThan(0.25);
        expect(Math.abs(pose.gazeY - previous.gazeY)).toBeLessThan(0.25);
        expect(Math.abs(pose.lift - previous.lift)).toBeLessThan(1.5);
        expect(Math.abs(pose.roll - previous.roll)).toBeLessThan(2);
        const coins = [
          [previous.drop, pose.drop],
          ...pose.coins.map((coin, index) => [previous.coins[index], coin]),
        ] as const;
        for (const [before, after] of coins) {
          if (before && after && before.opacity > 0.3 && after.opacity > 0.3) {
            expect(Math.abs(after.x - before.x)).toBeLessThan(3);
            expect(Math.abs(after.y - before.y)).toBeLessThan(3);
          }
        }
        previous = pose;
      }
    }
  });

  test("a visible coin's path through a blend reads only the source coin", () => {
    const from = {
      ...agentPose(),
      drop: { x: 50, y: 10, width: 1, opacity: 1 },
    };
    const shown = {
      ...agentPose(),
      drop: { x: 50, y: 30, width: 0.3, opacity: 1 },
    };
    const gone = { ...shown, drop: { ...shown.drop, opacity: 0.005 } };
    for (const weight of [0.1, 0.3, 0.45, 0.6, 0.9]) {
      const toShown = blendPose(from, shown, weight).drop;
      const toGone = blendPose(from, gone, weight).drop;
      expect(toGone.y).toBe(toShown.y);
      expect(toGone.x).toBe(toShown.x);
    }
    expect(blendPose(from, shown, 0.5).drop.opacity).toBe(0);
  });

  test("a hover flicked on and off never throws the dropped coin upward", () => {
    const starts = Array.from({ length: 24 }, (_, index) => 2 + index * 0.075);
    for (const gap of [0.08, 0.2]) {
      for (const start of starts) {
        const engine = createBrandAvatarEngine("logo", 0);
        engine.sample(start);
        const switches = [
          [start, "saving"],
          [start + gap, "logo"],
          [start + 2 * gap, "saving"],
        ] as const;
        let previous: { y: number; opacity: number } | null = null;
        for (let step = 0; step * STEP <= 2 * gap + 0.6; step += 1) {
          const time = start + step * STEP;
          for (const [at, state] of switches) {
            if (Math.abs(time - at) < STEP / 2) {
              engine.setState(state, time);
            }
          }
          const frame = engine.sample(time);
          const top = /^M[-\d.]+ ([-\d.]+)/.exec(frame.drop.disc);
          const now = top
            ? { y: Number(top[1]), opacity: frame.drop.opacity }
            : null;
          if (previous && now && previous.opacity > 0.3 && now.opacity > 0.3) {
            expect(now.y - previous.y).toBeGreaterThan(-3);
          }
          previous = now;
        }
      }
    }
  });

  test("a coin entering a transition only ever falls into the slot", () => {
    for (const [from, to] of [
      ["logo", "saving"],
      ["thinking", "success"],
      ["idle", "success"],
    ] as const) {
      for (const start of [0.3, 4.1, 17.6]) {
        const engine = createBrandAvatarEngine(from, 0);
        engine.sample(start);
        engine.setState(to, start);
        let lowest = Number.NEGATIVE_INFINITY;
        for (let step = 1; step * STEP <= TRANSITION_SECONDS; step += 1) {
          const frame = engine.sample(start + step * STEP);
          const top = /^M[-\d.]+ ([-\d.]+)/.exec(frame.drop.disc);
          if (frame.drop.opacity > 0.05 && top) {
            const y = Number(top[1]);
            expect(y).toBeGreaterThanOrEqual(lowest - 0.01);
            lowest = y;
          }
        }
      }
    }
  });
});

describe("brand avatar motion", () => {
  test("blinks stay in 0..1, happen, and land at different times per seed", () => {
    const sample = (seed: number) =>
      Array.from({ length: 2000 }, (_, step) => blinkAt(seed, step / 100));
    const first = sample(1);
    for (const closure of first) {
      expect(closure).toBeGreaterThanOrEqual(0);
      expect(closure).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...first)).toBeGreaterThan(0.9);
    expect(sample(2)).not.toEqual(first);
    expect(sample(1)).toEqual(first);
  });

  test("idle saccades stay inside Open Bot Avatar's range", () => {
    for (let step = 0; step < 2000; step += 1) {
      const [x, y] = saccadeAt(3, step / 50);
      expect(Math.abs(x)).toBeLessThanOrEqual(0.6);
      expect(Math.abs(y)).toBeLessThanOrEqual(0.35);
    }
  });

  test("a still frame never catches a blink, a glance or a hop", () => {
    for (const state of BRAND_AVATAR_STATES) {
      for (const seed of SEEDS) {
        for (const time of MOMENTS) {
          const pose = statePose(state, { time, age: time, seed, still: true });
          if (state !== "sleepy") {
            expect(pose.blink).toBe(0);
          }
          expect(brandAvatarFrame(state, time, seed, true)).toEqual(
            brandAvatarFrame(state, 0, 0, true)
          );
        }
      }
    }
  });

  test("the head steadies its sway while it follows the pointer", () => {
    const swing = (weight: number) => {
      const yaws = Array.from({ length: 200 }, (_, step) => {
        const pose = statePose("idle", {
          time: step / 20,
          age: 1,
          seed: 1,
          gaze: { x: 0, y: 0, weight },
        });
        return pose.yaw;
      });
      return Math.max(...yaws) - Math.min(...yaws);
    };
    expect(swing(1)).toBeLessThan(swing(0) * 0.5);
  });

  test("the pointer offset never leaves the unit circle", () => {
    const box = { left: 100, top: 100, width: 40, height: 40 };
    for (const pointer of [
      { x: 120, y: 120 },
      { x: 5000, y: 120 },
      { x: -4000, y: -9000 },
    ]) {
      const offset = pointerOffset(pointer, box);
      expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(pointerOffset({ x: 120, y: 120 }, box)).toEqual({ x: 0, y: 0 });
  });

  test("attention eases toward the pointer and back to rest", () => {
    let state = RESTING_ATTENTION;
    for (let step = 0; step < 120; step += 1) {
      state = stepAttention(state, { x: 0.8, y: -0.2 }, 1 / 60);
    }
    expect(state.x).toBeCloseTo(0.8, 2);
    expect(state.attention).toBeGreaterThan(0.99);
    for (let step = 0; step < 240; step += 1) {
      state = stepAttention(state, null, 1 / 60);
    }
    expect(state.attention).toBeLessThan(0.01);
    expect(attentionGaze(RESTING_ATTENTION)).toBeUndefined();
  });

  test("the head and the eyes turn toward the pointer; the mark never does", () => {
    const toward = attend(agentPose(), { x: 1, y: 0, weight: 1 });
    expect(toward.yaw).toBeGreaterThan(REST_YAW);
    expect(toward.gazeX).toBeGreaterThan(0);
    expect(attend(markPose(), { x: 1, y: 0, weight: 1 })).toEqual(markPose());
  });
});

describe("brand avatar engine", () => {
  test("a transition lands exactly on the target state", () => {
    const engine = createBrandAvatarEngine("idle", 0);
    engine.sample(0.5);
    engine.setState("celebrating", 0.5);

    const landed = 0.5 + TRANSITION_SECONDS;
    expect(engine.sample(landed)).toEqual(
      settledFrame("celebrating", landed, landed - 0.5)
    );
    expect(engine.state()).toBe("celebrating");
  });

  test("leaving the logo opens the eyes partway through the blend", () => {
    const engine = createBrandAvatarEngine("logo", 0);
    const before = engine.sample(1);
    engine.setState("happy", 1);
    const during = engine.sample(1 + TRANSITION_SECONDS / 3);

    expect(during.body).not.toBe(before.body);
    const shown = during.eyes.filter((eye) => eye.opacity > 0);
    expect(shown.length).toBeGreaterThan(0);
    for (const eye of shown) {
      expect(eye.opacity).toBeLessThan(1);
    }
  });

  test("interrupting a transition still converges on the last state", () => {
    const engine = createBrandAvatarEngine("sleepy", 0);
    engine.sample(0.2);
    engine.setState("loading", 0.2);
    engine.sample(0.3);
    engine.setState("error", 0.3);

    const landed = 0.3 + TRANSITION_SECONDS;
    expect(engine.sample(landed)).toEqual(
      settledFrame("error", landed, landed - 0.3)
    );
  });

  test("re-entering the current state does not restart it", () => {
    const engine = createBrandAvatarEngine("thinking", 0);
    const frame = engine.sample(2);
    engine.setState("thinking", 2);
    expect(engine.sample(2)).toEqual(frame);
  });
});
