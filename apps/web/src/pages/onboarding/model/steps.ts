import type { OnboardingState } from "./onboarding-state";

export const ONBOARDING_STEPS = {
  bank: 2,
  budgetMonth: 1,
  country: 0,
} as const;

export const resumedStep = (state: OnboardingState | null): number => {
  if (state === null) {
    return ONBOARDING_STEPS.country;
  }

  return state.budgetMonth === undefined
    ? ONBOARDING_STEPS.budgetMonth
    : ONBOARDING_STEPS.bank;
};
