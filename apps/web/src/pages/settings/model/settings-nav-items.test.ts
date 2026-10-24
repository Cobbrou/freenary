import { describe, expect, it } from "bun:test";

import {
  operatorStandingOf,
  SETTINGS_NAV_ITEMS,
  showsServices,
} from "./settings-nav-items";

describe("SETTINGS_NAV_ITEMS", () => {
  it("lists one Connections item and no Integrations item", () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.section)).toEqual([
      "appearance",
      "connections",
      "budget",
      "security",
    ]);
  });
});

describe("showsServices", () => {
  it("shows the services to the operator", () => {
    expect(showsServices("operator")).toBe(true);
  });

  it("never shows them to a member", () => {
    expect(showsServices("member")).toBe(false);
  });

  it("holds them back while the standing is pending", () => {
    expect(showsServices("pending")).toBe(false);
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
