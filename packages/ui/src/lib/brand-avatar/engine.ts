import { type AvatarFrame, poseToFrame } from "./frame";
import { clamp01, smoothstep } from "./math";
import { blendPose, type Gaze, normalizePose, type Pose } from "./pose";
import { type BrandAvatarState, statePose, TRANSITION_SECONDS } from "./states";

/**
 * Drives the avatar without owning a clock: the caller passes the time, so a
 * paused avatar, a frozen thumbnail and a test all produce the same frame.
 *
 * A state change snapshots the pose being displayed and blends from that
 * snapshot to the new state's live pose over Open Bot Avatar's 420 ms
 * smoothstep, so an interrupted transition is exactly as smooth as a completed
 * one. The pointer gaze goes into each state's pose, so the blend carries the
 * head's turn toward the cursor through a transition rather than dropping it.
 */
export type BrandAvatarEngine = {
  state: () => BrandAvatarState;
  setState: (next: BrandAvatarState, time: number) => void;
  sample: (time: number, gaze?: Gaze) => AvatarFrame;
};

export const createBrandAvatarEngine = (
  initial: BrandAvatarState,
  time = 0,
  seed = 0
): BrandAvatarEngine => {
  let current = initial;
  let startedAt = time;
  let source: Pose | null = null;
  let shown: Pose = statePose(initial, { time, age: 0, seed });

  return {
    state: () => current,

    setState: (next, at) => {
      if (next === current) {
        return;
      }
      source = shown;
      current = next;
      startedAt = at;
    },

    sample: (at, gaze) => {
      const age = at - startedAt;
      const target = statePose(current, { time: at, age, seed, gaze });
      let pose = target;
      if (source) {
        const weight = smoothstep(clamp01(age / TRANSITION_SECONDS));
        pose = weight >= 1 ? target : blendPose(source, target, weight);
        if (weight >= 1) {
          source = null;
        }
      }
      shown = pose;
      return poseToFrame(normalizePose(pose));
    },
  };
};

/**
 * One settled frame of a state, with no transition and no engine to keep
 * alive — what a state board, the favicon or a still export needs. A `still`
 * frame is the reduced-motion pose: no blink, no glance, no sway.
 */
export const brandAvatarFrame = (
  state: BrandAvatarState,
  time: number,
  seed = 0,
  still = false
): AvatarFrame =>
  poseToFrame(
    normalizePose(statePose(state, { time, age: time, seed, still }))
  );
