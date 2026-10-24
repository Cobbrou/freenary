import { describe, expect, it } from "bun:test";

import { settingsSectionOf } from "./settings-sections";

describe("settingsSectionOf", () => {
  it("keeps a section that exists", () => {
    expect(settingsSectionOf("connections")).toBe("connections");
    expect(settingsSectionOf("security")).toBe("security");
  });

  it("sends a link to the former Integrations section to Connections", () => {
    expect(settingsSectionOf("integrations")).toBe("connections");
  });

  it("leaves an unknown or missing section to the default", () => {
    expect(settingsSectionOf("billing")).toBeUndefined();
    expect(settingsSectionOf(undefined)).toBeUndefined();
  });

  it("ignores a name inherited from Object", () => {
    expect(settingsSectionOf("toString")).toBeUndefined();
    expect(settingsSectionOf("constructor")).toBeUndefined();
    expect(settingsSectionOf("__proto__")).toBeUndefined();
  });
});
