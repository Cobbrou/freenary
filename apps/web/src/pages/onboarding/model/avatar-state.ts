import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";

const BANK_STEP = 1;

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

  return step === BANK_STEP && connectedCount > 0 ? "success" : "idle";
};
