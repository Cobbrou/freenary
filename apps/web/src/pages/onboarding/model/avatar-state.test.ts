import { describe, expect, it } from "bun:test";

import { onboardingAvatarState } from "./avatar-state";
import { ONBOARDING_STEPS } from "./steps";

describe("onboardingAvatarState", () => {
  it("loads while onboarding completes", () => {
    expect(
      onboardingAvatarState({
        connectedCount: 1,
        isCompleting: true,
        step: ONBOARDING_STEPS.bank,
      })
    ).toBe("loading");
  });

  it("succeeds on the bank step once a bank is connected", () => {
    expect(
      onboardingAvatarState({
        connectedCount: 1,
        isCompleting: false,
        step: ONBOARDING_STEPS.bank,
      })
    ).toBe("success");
  });

  it("idles otherwise", () => {
    expect(
      onboardingAvatarState({
        connectedCount: 0,
        isCompleting: false,
        step: ONBOARDING_STEPS.bank,
      })
    ).toBe("idle");

    expect(
      onboardingAvatarState({
        connectedCount: 1,
        isCompleting: false,
        step: ONBOARDING_STEPS.budgetMonth,
      })
    ).toBe("idle");
  });
});
