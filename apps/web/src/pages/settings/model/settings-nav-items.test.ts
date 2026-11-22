import { describe, expect, it } from "bun:test";

import { SETTINGS_SECTIONS } from "@/shared/config";

import {
  isSectionShownTo,
  operatorStandingOf,
  SETTINGS_NAV_ITEMS,
  settingsNavCategoriesFor,
  showsServices,
} from "./settings-nav-items";

const sectionsByCategory = (standing: "member" | "operator" | "pending") =>
  settingsNavCategoriesFor(standing).map((category) => [
    category.id,
    category.items.map((item) => item.section),
  ]);

describe("SETTINGS_NAV_ITEMS", () => {
  it("gives every section exactly one tab", () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.section).toSorted()).toEqual(
      [...SETTINGS_SECTIONS].toSorted()
    );
  });
});

describe("settingsNavCategoriesFor", () => {
  it("groups the operator's tabs under four categories", () => {
    expect(sectionsByCategory("operator")).toEqual([
      ["preferences", ["appearance"]],
      ["finances", ["bank-accounts", "budget", "categories"]],
      ["security", ["sign-in", "sessions", "api-keys"]],
      ["instance", ["services"]],
    ]);
  });

  it("drops the Instance category for a member and while pending", () => {
    for (const standing of ["member", "pending"] as const) {
      expect(sectionsByCategory(standing).map(([id]) => id)).toEqual([
        "preferences",
        "finances",
        "security",
      ]);
    }
  });
});

describe("isSectionShownTo", () => {
  it("keeps Services for the operator only", () => {
    expect(isSectionShownTo("services", "operator")).toBe(true);
    expect(isSectionShownTo("services", "member")).toBe(false);
    expect(isSectionShownTo("budget", "member")).toBe(true);
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
