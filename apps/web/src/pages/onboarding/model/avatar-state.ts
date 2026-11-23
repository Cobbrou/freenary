import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";

import { ONBOARDING_STEPS } from "./steps";

export interface OnboardingAvatarInput {
  connectedCount: number;
  isCompleting: boolean;
  step: number;
}

export const onboardingAvatarState = ({
  connectedCount,
  isCompleting,
  step,
}: OnboardingAvatarInput): BrandAvatarState => {
  if (isCompleting) {
    return "loading";
  }

  return step === ONBOARDING_STEPS.bank && connectedCount > 0
    ? "success"
    : "idle";
};
