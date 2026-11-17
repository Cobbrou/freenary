import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";

export interface SetupAvatarInput {
  hasCompletionFailure: boolean;
  hasFailedOutcome: boolean;
  hasOutcome: boolean;
  isBusy: boolean;
  restartPhase: "idle" | "reconnecting" | "stalled";
}

export const setupAvatarState = ({
  hasCompletionFailure,
  hasFailedOutcome,
  hasOutcome,
  isBusy,
  restartPhase,
}: SetupAvatarInput): BrandAvatarState => {
  if (restartPhase === "stalled" || hasCompletionFailure) {
    return "error";
  }

  if (isBusy || restartPhase === "reconnecting") {
    return "loading";
  }

  if (hasFailedOutcome) {
    return "error";
  }

  return hasOutcome ? "success" : "idle";
};
