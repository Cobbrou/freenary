import { COIN_RADIUS, SLOT_LINE } from "./mark";
import {
  blinkAt,
  clamp01,
  cycle,
  hash01,
  saccadeAt,
  smoothstep,
  TAU,
} from "./math";
import {
  agentPose,
  attend,
  type CoinPose,
  type Gaze,
  markPose,
  type Pose,
} from "./pose";

/**
 * The state library. Each entry turns a moment into a complete pose;
 * `engine.ts` blends between two of them. Nothing here reads a clock, so the
 * same `(state, time, age, seed)` always produces the same frame.
 *
 * `logo` is the Freenary mark and never moves. Every other state is the agent,
 * built from Open Bot Avatar's three motions — `idle`, `happy` and `thinking`,
 * ported value for value — and from the same handful of levers for the rest:
 * turn, tilt, lift, squash, gaze, blink and squint. The money moments add
 * Freenary's own props on top: a coin saved into the slot, coins tossed out of
 * it or flipped above the head, gold glints, and a shine across the head.
 *
 * `time` is absolute, which keeps every cycle continuous across a state change.
 * `age` is how long the state has been the target, and drives the one-shot
 * accents — the pop of a surprise, the shake of an error. A `still` moment is
 * Open Bot Avatar's reduced-motion pose: every cycle at rest, no blink, no
 * glance, no hop — only what the state holds steadily.
 */

export const BRAND_AVATAR_STATES = [
  "logo",
  "idle",
  "happy",
  "excited",
  "curious",
  "surprised",
  "confused",
  "thinking",
  "concerned",
  "sleepy",
  "celebrating",
  "loading",
  "notification",
  "listening",
  "speaking",
  "success",
  "error",
  "wink",
  "shy",
  "saving",
  "rich",
] as const;

export type BrandAvatarState = (typeof BRAND_AVATAR_STATES)[number];

export type Moment = {
  time: number;
  age: number;
  seed: number;
  /** Reduced motion: hold the state's steady pose and nothing that moves. */
  still?: boolean;
  /** Where the pointer is, if the avatar is following it. */
  gaze?: Gaze;
};

/**
 * One state's clock. Each avatar runs its own offset, so a row of them never
 * moves in step, and a still moment zeroes every cycle, blink and glance.
 */
type Clock = {
  t: number;
  still: boolean;
  /** Open Bot Avatar's sway damping: the head steadies while it attends. */
  sway: number;
  wave: (seconds: number, phase?: number) => number;
  blink: (rate?: number) => number;
  glance: () => [number, number];
};

const ATTENTION_DAMPING = 0.7;

const clockOf = ({ time, seed, still = false, gaze }: Moment): Clock => {
  const t = still ? 0 : time + hash01(seed, 7) * 10;
  return {
    t,
    still,
    sway: 1 - ATTENTION_DAMPING * smoothstep(gaze?.weight ?? 0),
    wave: (seconds, phase = 0) => (still ? 0 : cycle(t, seconds, phase)),
    blink: (rate = 1) => (still ? 0 : blinkAt(seed, t * rate)),
    glance: () => (still ? [0, 0] : saccadeAt(seed, t)),
  };
};

/** A hop that lands hard: lift, plus the squash on touching down. */
const hopping = (
  pose: Pose,
  clock: Clock,
  period: number,
  height: number
): void => {
  if (clock.still) {
    return;
  }
  const phase = ((clock.t % period) + period) % period;
  const t = phase / period;
  const arc = 4 * t * (1 - t);
  const landing = clamp01(1 - Math.min(t, 1 - t) / 0.12);
  pose.lift = -height * arc;
  pose.sy = 1 - 0.09 * landing + 0.03 * arc;
  pose.sx = 1 + 0.07 * landing - 0.015 * arc;
};

/** Slow float and breath, shared by every calm state. */
const breathing = (pose: Pose, clock: Clock, depth = 1): void => {
  if (clock.still) {
    return;
  }
  pose.lift = -0.45 * depth * (1 - Math.cos((TAU * clock.t) / 3.4));
  const swell = clock.wave(3.4, -Math.PI / 2);
  pose.sy = 1 + 0.012 * depth * swell;
  pose.sx = 1 - 0.008 * depth * swell;
};

/** A one-shot accent in 0..1 over `seconds`; a still moment shows it settled. */
const accent = (clock: Clock, age: number, seconds: number): number =>
  clock.still ? 0 : Math.sin(clamp01(age / seconds) * Math.PI);

/** Seconds a dropped coin takes from its release to the slot. */
const COIN_FALL_SECONDS = 0.6;
const COIN_RELEASE_HEIGHT = 34;

/**
 * A coin falling into the slot, at `progress` 0 (released) to 1 (gone). It
 * drops under gravity and turns edge-on just before the slot, which is the
 * only way a coin fits.
 */
const fallingCoin = (progress: number): CoinPose => {
  const p = clamp01(progress);
  const start = SLOT_LINE - COIN_RELEASE_HEIGHT;
  const end = SLOT_LINE + COIN_RADIUS + 1;
  return {
    x: 50,
    y: start + (end - start) * p * p,
    width: 1 - 0.85 * smoothstep((p - 0.35) / 0.45),
    opacity: progress >= 1 ? 0 : smoothstep(p / 0.12),
  };
};

/** The body's little gulp as a coin goes in: 0..1 around the end of a fall. */
const gulpAt = (progress: number): number =>
  Math.sin(clamp01((progress - 0.8) / 0.4) * Math.PI);

const gulping = (pose: Pose, gulp: number): void => {
  pose.sy -= 0.05 * gulp;
  pose.sx += 0.035 * gulp;
};

/**
 * Where the eyes look while a coin falls: up at it, then back to the viewer.
 * They lift over the first quarter of the fall, the length of an Open Bot
 * Avatar glance, so a new coin never snaps them upward.
 */
const watchingFall = (pose: Pose, progress: number): void => {
  const follow = smoothstep(progress / 0.25) * (1 - smoothstep(progress));
  pose.gazeY = -0.9 * follow;
  pose.gazeX = -0.15 * follow;
};

/** Sideways reach of each tossed coin; the middle one goes mostly up. */
const TOSS_SPREAD = [-46, 12, 46] as const;
const TOSS_SECONDS = 1.5;

/**
 * Coins tossed out of the slot, each on its own beat: a quick rise, then a
 * fall past the cheeks, turning over as it goes.
 */
const tossingCoins = (pose: Pose, clock: Clock): void => {
  pose.coins = pose.coins.map((_, index) => {
    const phase = (((clock.t / TOSS_SECONDS + index / 3) % 1) + 1) % 1;
    return {
      x: 50 + (TOSS_SPREAD[index] ?? 0) * phase,
      y: SLOT_LINE - 4 - 110 * phase + 170 * phase * phase,
      width: Math.abs(Math.cos(phase * TAU * 1.5 + index)),
      opacity: smoothstep(phase / 0.1) * (1 - smoothstep((phase - 0.8) / 0.2)),
    };
  });
};

const TWINKLE_SECONDS = 1.3;

/** Glints that swell and shrink on staggered beats, never all at once. */
const twinkling = (pose: Pose, clock: Clock, size: number): void => {
  pose.sparks = pose.sparks.map((spark, index) => {
    const phase = (((clock.t / TWINKLE_SECONDS + index * 0.27) % 1) + 1) % 1;
    return {
      ...spark,
      size: size * Math.max(0, Math.sin(Math.PI * phase)) ** 1.5,
      turn: 0.35 * Math.sin(TAU * phase),
    };
  });
};

/** One burst of glints around the head, `amount` 0..1. */
const glinting = (pose: Pose, amount: number, size = 7): void => {
  pose.sparks = pose.sparks.map((spark) => ({ ...spark, size: size * amount }));
};

const SHINE_SECONDS = 0.9;

/** A highlight crossing the head once every `period` seconds. */
const shining = (
  pose: Pose,
  clock: Clock,
  period: number,
  strength: number
): void => {
  const local = (((clock.t % period) + period) % period) / SHINE_SECONDS;
  if (clock.still || local >= 1) {
    return;
  }
  pose.shine = {
    at: -1.3 + 2.6 * smoothstep(local),
    opacity: strength * Math.sin(Math.PI * local),
  };
};

const happyEyes = (pose: Pose): void => {
  pose.happyL = 1;
  pose.happyR = 1;
};

const logo = (): Pose => markPose();

/** Open Bot Avatar's `idle`. */
const idle = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  pose.yaw += 0.07 * clock.sway * clock.wave(6.1);
  pose.pitch += 0.04 * clock.sway * clock.wave(4.7, 1);
  pose.roll = 1.6 * clock.wave(5.3, 2);
  breathing(pose, clock);
  pose.blink = clock.blink();
  [pose.gazeX, pose.gazeY] = clock.glance();
  shining(pose, clock, 7, 0.22);
  return pose;
};

/** Open Bot Avatar's `happy`. */
const happy = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  hopping(pose, clock, 0.92, 3.2);
  pose.roll = 4.5 * clock.wave(1.84);
  pose.yaw += 0.1 * clock.wave(1.84, 0.6);
  happyEyes(pose);
  return pose;
};

/** Open Bot Avatar's `thinking`. */
const thinking = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  pose.yaw += 0.12 + 0.05 * clock.sway * clock.wave(7.3);
  pose.pitch += 0.08;
  pose.roll = -5 + 1.4 * clock.wave(4.1);
  pose.lift = clock.still ? 0 : -0.5 * (1 - Math.cos((TAU * clock.t) / 5.2));
  pose.gazeX = 0.55 + 0.3 * clock.wave(5.6);
  pose.gazeY = -0.8;
  pose.squintL = 0.22;
  pose.squintR = 0.32 + 0.1 * clock.wave(3.1);
  pose.blink = clock.blink(0.7);
  return pose;
};

const excited = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  hopping(pose, clock, 0.62, 4);
  pose.roll = 3 * clock.wave(1.24);
  pose.squintL = -0.25;
  pose.squintR = -0.25;
  pose.gazeY = -0.3;
  twinkling(pose, clock, 6);
  return pose;
};

const curious = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  pose.yaw += 0.18;
  pose.roll = 8 + 1.2 * clock.wave(4.4);
  pose.gazeX = 0.5 + 0.2 * clock.wave(3.8);
  pose.gazeY = -0.2;
  pose.squintL = 0.3;
  pose.squintR = -0.1;
  pose.blink = clock.blink();
  return pose;
};

const surprised = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  const pop = accent(clock, moment.age, 0.4);
  breathing(pose, clock, 0.5);
  pose.lift -= 4 * pop;
  pose.sy += 0.06 * pop;
  pose.sx -= 0.04 * pop;
  pose.pitch += 0.08;
  pose.squintL = -0.4;
  pose.squintR = -0.4;
  return pose;
};

const confused = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  pose.roll = 7 * clock.wave(2.6);
  pose.yaw += 0.08 * clock.wave(2.6, 1);
  pose.gazeX = -0.4 + 0.3 * clock.wave(3.3);
  pose.gazeY = -0.4;
  pose.squintL = 0.45;
  pose.squintR = -0.1;
  pose.blink = clock.blink();
  return pose;
};

const concerned = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock, 0.6);
  pose.pitch -= 0.25;
  pose.roll = -3;
  pose.lift += 1;
  pose.gazeX = 0.1 * clock.wave(5);
  pose.gazeY = 0.5;
  pose.squintL = 0.2;
  pose.squintR = 0.2;
  pose.blink = clock.blink(1.2);
  return pose;
};

const sleepy = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  const breath = clock.wave(5.5);
  pose.pitch -= 0.2;
  pose.roll = 5 + 2 * breath;
  pose.lift = 1 + breath;
  pose.sy = 1 - 0.025 * breath;
  pose.sx = 1 + 0.015 * breath;
  pose.gazeY = 0.4;
  pose.blink = 0.82 + 0.1 * clock.wave(5.5, 1);
  return pose;
};

const celebrating = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  hopping(pose, clock, 0.7, 5.5);
  pose.roll = 9 * clock.wave(1.4);
  pose.yaw += 0.18 * clock.wave(1.4, 0.6);
  happyEyes(pose);
  tossingCoins(pose, clock);
  twinkling(pose, clock, 7);
  return pose;
};

/** A coin flipped above the head while the sums are done; the eyes follow it. */
const loading = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  const toss = clock.still ? 0 : Math.abs(Math.sin((TAU * clock.t) / 1.1));
  const [coin = fallingCoin(1), ...rest] = pose.coins;
  pose.coins = [
    {
      ...coin,
      x: 50,
      y: -4 - 7 * toss,
      width: clock.still ? 1 : Math.abs(Math.cos(clock.t * 7)),
      opacity: 1,
    },
    ...rest,
  ];
  pose.gazeY = -0.9 - 0.1 * toss;
  pose.pitch += 0.1 + 0.04 * toss;
  pose.squintL = 0.1;
  pose.squintR = 0.1;
  pose.blink = clock.blink(0.6);
  return pose;
};

const notification = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  const hop = accent(clock, moment.age, 0.5);
  pose.lift -= 4 * hop;
  pose.sy += 0.05 * hop;
  pose.yaw = -0.05;
  pose.pitch = 0.1;
  pose.squintL = -0.2;
  pose.squintR = -0.2;
  pose.blink = clock.blink();
  const rise = clock.still ? 1 : smoothstep(moment.age / 0.45);
  const [coin = fallingCoin(1), ...rest] = pose.coins;
  pose.coins = [
    {
      ...coin,
      x: 50,
      y: SLOT_LINE - 4 - 16 * rise + 1.5 * clock.wave(1.6),
      width: 1,
      opacity: rise,
    },
    ...rest,
  ];
  pose.gazeY = -0.7 * rise;
  return pose;
};

const listening = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  pose.yaw = -0.08 + 0.04 * clock.wave(6);
  pose.pitch = 0.05 + 0.06 * Math.max(0, clock.wave(1.3));
  pose.roll = 3;
  pose.squintL = -0.1;
  pose.squintR = -0.1;
  pose.blink = clock.blink(0.8);
  return pose;
};

/** Speech-shaped envelope in 0..1 built from three incommensurable sines. */
const voice = (clock: Clock): number =>
  clock.still
    ? 0
    : clamp01(
        0.45 +
          0.3 * cycle(clock.t * 1.4, 1 / 1.7) +
          0.22 * cycle(clock.t * 1.4, 1 / 3.3, 2) +
          0.16 * cycle(clock.t * 1.4, 1 / 0.7, 4.4)
      );

/** No mouth in this style: the head nods along with the words instead. */
const speaking = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  const level = voice(clock);
  pose.yaw += 0.06 * clock.sway * clock.wave(6.1);
  pose.roll = 1.6 * clock.wave(5.3, 2);
  pose.lift = -1.4 * level;
  pose.pitch += 0.06 * level;
  pose.sy = 1 + 0.025 * level;
  pose.sx = 1 - 0.015 * level;
  pose.blink = clock.blink();
  [pose.gazeX, pose.gazeY] = clock.glance();
  return pose;
};

/** How long either side of the landing the eyes close to swap to a grin. */
const GRIN_BLINK = 0.12;

/** A coin dropped into the slot, a gulp, then a happy hop and a flash of gold. */
const success = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const progress = clock.still ? 2 : moment.age / COIN_FALL_SECONDS;
  const pose = agentPose();
  breathing(pose, clock);
  watchingFall(pose, Math.min(progress, 1));
  pose.drop = fallingCoin(progress);
  gulping(pose, gulpAt(progress));
  if (progress >= 1) {
    happyEyes(pose);
  }
  pose.blink = clamp01(1 - Math.abs(progress - 1) / GRIN_BLINK);
  const hop = accent(clock, moment.age - COIN_FALL_SECONDS, 0.55);
  pose.lift -= 4 * hop;
  pose.sy += 0.05 * hop;
  glinting(pose, accent(clock, moment.age - COIN_FALL_SECONDS, 0.8));
  return pose;
};

const error = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock, 0.5);
  const shake = clock.still
    ? 0
    : Math.exp(-moment.age * 2.6) * Math.sin(moment.age * TAU * 5.5);
  pose.yaw += 0.35 * shake;
  pose.roll = 4 * shake;
  pose.pitch -= 0.12;
  pose.squintL = 0.55;
  pose.squintR = 0.55;
  pose.gazeY = 0.2;
  return pose;
};

const wink = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  const beat = smoothstep(Math.max(0, clock.wave(1.8)));
  pose.lift -= 1.5 * beat;
  pose.roll = -5;
  pose.happyL = 1;
  pose.gazeX = 0.2;
  return pose;
};

/** Eyes politely closed and the head turned away — for a secret being typed. */
const shy = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  pose.yaw = -0.55;
  pose.pitch = -0.12;
  pose.roll = -6;
  happyEyes(pose);
  return pose;
};

const SAVING_SECONDS = 1.8;
/** The still moment of saving: just after a coin went in, eyes pleased. */
const SAVED_STILL = 1.3;

/** Coin after coin into the slot — putting money aside. */
const saving = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  breathing(pose, clock);
  const local = clock.still
    ? SAVED_STILL
    : (((clock.t % SAVING_SECONDS) + SAVING_SECONDS) % SAVING_SECONDS) /
      COIN_FALL_SECONDS;
  pose.drop = fallingCoin(local);
  gulping(pose, gulpAt(local));
  watchingFall(pose, Math.min(local, 1));
  const pleased =
    clamp01((local - 0.95) / 0.3) * (1 - clamp01((local - 2.2) / 0.4));
  pose.squintL = 0.3 * pleased;
  pose.squintR = 0.3 * pleased;
  pose.sparks = pose.sparks.map((spark, index) =>
    index === 1
      ? {
          x: 66,
          y: SLOT_LINE - 9,
          size: 6 * Math.sin(clamp01((local - 0.9) / 0.6) * Math.PI),
          turn: 0.4 * local,
        }
      : spark
  );
  return pose;
};

/** Plenty: coins tossed out of the slot, glints all round, a gleaming head. */
const rich = (moment: Moment): Pose => {
  const clock = clockOf(moment);
  const pose = agentPose();
  hopping(pose, clock, 0.92, 2.2);
  pose.roll = 3 * clock.wave(1.84);
  happyEyes(pose);
  tossingCoins(pose, clock);
  twinkling(pose, clock, 7);
  shining(pose, clock, 2.2, 0.35);
  return pose;
};

const BUILDS: Record<BrandAvatarState, (moment: Moment) => Pose> = {
  logo,
  idle,
  happy,
  excited,
  curious,
  surprised,
  confused,
  thinking,
  concerned,
  sleepy,
  celebrating,
  loading,
  notification,
  listening,
  speaking,
  success,
  error,
  wink,
  shy,
  saving,
  rich,
};

/**
 * A state's pose at a moment, turned toward the pointer when there is one —
 * applied here, inside the state, so a transition blends the attending pose
 * just as Open Bot Avatar's does.
 */
export const statePose = (state: BrandAvatarState, moment: Moment): Pose =>
  attend(BUILDS[state](moment), moment.still ? undefined : moment.gaze);

/** Open Bot Avatar blends every change of motion over the same 420 ms. */
export const TRANSITION_SECONDS = 0.42;
