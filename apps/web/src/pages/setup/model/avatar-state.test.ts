import { describe, expect, it } from "bun:test";

import { setupAvatarState } from "./avatar-state";

const resting = {
  hasCompletionFailure: false,
  hasFailedOutcome: false,
  hasOutcome: false,
  isBusy: false,
  restartPhase: "idle",
} as const;

const verified = { ...resting, hasOutcome: true };
const rejected = { ...resting, hasFailedOutcome: true, hasOutcome: true };

describe("setupAvatarState", () => {
  it("shows an error when the restart stalls", () => {
    expect(setupAvatarState({ ...resting, restartPhase: "stalled" })).toBe(
      "error"
    );
  });

  it("shows an error when completion fails", () => {
    expect(setupAvatarState({ ...resting, hasCompletionFailure: true })).toBe(
      "error"
    );
  });

  it("loads while a check, save or completion is pending", () => {
    expect(setupAvatarState({ ...resting, isBusy: true })).toBe("loading");
  });

  it("loads while the server reconnects", () => {
    expect(setupAvatarState({ ...resting, restartPhase: "reconnecting" })).toBe(
      "loading"
    );
  });

  it("shows an error for a failed outcome", () => {
    expect(setupAvatarState(rejected)).toBe("error");
  });

  it("succeeds for a successful outcome", () => {
    expect(setupAvatarState(verified)).toBe("success");
  });

  it("idles otherwise", () => {
    expect(setupAvatarState(resting)).toBe("idle");
  });

  it("lets a stalled restart win over a pending mutation", () => {
    expect(
      setupAvatarState({ ...resting, isBusy: true, restartPhase: "stalled" })
    ).toBe("error");
  });

  it("lets a pending mutation win over a failed outcome", () => {
    expect(setupAvatarState({ ...rejected, isBusy: true })).toBe("loading");
  });
});
