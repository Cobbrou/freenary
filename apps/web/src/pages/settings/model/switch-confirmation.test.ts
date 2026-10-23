import { describe, expect, it } from "bun:test";

import { needsSwitchConfirmation } from "./switch-confirmation";

const powensWithOneConnection = {
  chosenVariantId: "enable-banking",
  connectionCount: 1,
  currentVariantId: "powens",
  integrationId: "banking",
};

describe("needsSwitchConfirmation", () => {
  it("asks before switching the bank provider while a connection exists", () => {
    expect(needsSwitchConfirmation(powensWithOneConnection)).toBe(true);
  });

  it("does not ask when saving the same provider's credentials", () => {
    expect(
      needsSwitchConfirmation({
        ...powensWithOneConnection,
        chosenVariantId: "powens",
      })
    ).toBe(false);
  });

  it("does not ask when no bank connection exists", () => {
    expect(
      needsSwitchConfirmation({
        ...powensWithOneConnection,
        connectionCount: 0,
      })
    ).toBe(false);
  });

  it("asks when the connection count could not be read", () => {
    expect(
      needsSwitchConfirmation({
        ...powensWithOneConnection,
        connectionCount: undefined,
      })
    ).toBe(true);
  });

  it("asks when a provider is chosen while none was set", () => {
    expect(
      needsSwitchConfirmation({
        ...powensWithOneConnection,
        chosenVariantId: "powens",
        currentVariantId: "disabled",
      })
    ).toBe(true);
  });

  it("never asks for another integration", () => {
    expect(
      needsSwitchConfirmation({
        chosenVariantId: "smtp",
        connectionCount: 3,
        currentVariantId: "resend",
        integrationId: "email",
      })
    ).toBe(false);
  });
});
