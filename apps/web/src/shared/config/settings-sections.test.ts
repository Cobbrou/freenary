import { describe, expect, it } from "bun:test";

import { settingsSectionOf } from "./settings-sections";

describe("settingsSectionOf", () => {
  it("keeps a section that exists", () => {
    expect(settingsSectionOf("bank-accounts")).toBe("bank-accounts");
    expect(settingsSectionOf("api-keys")).toBe("api-keys");
  });

  it("sends a link to a former section to the tab that holds it now", () => {
    expect(settingsSectionOf("connections")).toBe("bank-accounts");
    expect(settingsSectionOf("integrations")).toBe("services");
    expect(settingsSectionOf("security")).toBe("sign-in");
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
