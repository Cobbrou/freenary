import { describe, expect, it } from "bun:test";

import {
  operatorStandingOf,
  settingsNavItemsFor,
  shownSettingsSection,
} from "./settings-nav-items";

const sectionsFor = (standing: Parameters<typeof settingsNavItemsFor>[0]) =>
  settingsNavItemsFor(standing).map((item) => item.section);

describe("settingsNavItemsFor", () => {
  it("lists Integrations last for the operator", () => {
    expect(sectionsFor("operator")).toEqual([
      "appearance",
      "connections",
      "budget",
      "security",
      "integrations",
    ]);
  });

  it("leaves Integrations out for a member", () => {
    expect(sectionsFor("member")).not.toContain("integrations");
  });

  it("leaves Integrations out until the standing is known", () => {
    expect(sectionsFor("pending")).not.toContain("integrations");
  });
});

describe("shownSettingsSection", () => {
  it("shows Integrations to the operator", () => {
    expect(shownSettingsSection("integrations", "operator")).toBe(
      "integrations"
    );
  });

  it("falls back to the default section for a member", () => {
    expect(shownSettingsSection("integrations", "member")).toBe("appearance");
  });

  it("shows nothing for Integrations while the standing is pending", () => {
    expect(shownSettingsSection("integrations", "pending")).toBeNull();
  });

  it("shows any other section to everyone", () => {
    expect(shownSettingsSection("security", "member")).toBe("security");
    expect(shownSettingsSection("budget", "pending")).toBe("budget");
  });
});

describe("operatorStandingOf", () => {
  it("is pending while the status loads", () => {
    expect(operatorStandingOf({ isOperator: undefined, isPending: true })).toBe(
      "pending"
    );
  });

  it("reads the operator", () => {
    expect(operatorStandingOf({ isOperator: true, isPending: false })).toBe(
      "operator"
    );
  });

  it("reads a member, or a status that failed to load, as a member", () => {
    expect(operatorStandingOf({ isOperator: false, isPending: false })).toBe(
      "member"
    );

    expect(
      operatorStandingOf({ isOperator: undefined, isPending: false })
    ).toBe("member");
  });
});
