import { describe, expect, it } from "bun:test";

import { onboardingAvatarState } from "./avatar-state";

describe("onboardingAvatarState", () => {
  it("loads while onboarding completes", () => {
    expect(
      onboardingAvatarState({ connectedCount: 1, isCompleting: true, step: 1 })
    ).toBe("loading");
  });

  it("succeeds on the bank step once a bank is connected", () => {
    expect(
      onboardingAvatarState({ connectedCount: 1, isCompleting: false, step: 1 })
    ).toBe("success");
  });

  it("idles otherwise", () => {
    expect(
      onboardingAvatarState({ connectedCount: 0, isCompleting: false, step: 1 })
    ).toBe("idle");

    expect(
      onboardingAvatarState({ connectedCount: 1, isCompleting: false, step: 0 })
    ).toBe("idle");
  });
});
