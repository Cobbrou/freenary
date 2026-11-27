import { describe, expect, it } from "bun:test";

import { ACCOUNT_SETTINGS_ROUTE_ID, navTrailOf } from "./nav-items";

describe("navTrailOf", () => {
  it("ends the account settings trail with the account name", () => {
    expect(navTrailOf(ACCOUNT_SETTINGS_ROUTE_ID, "Compte joint")).toEqual([
      "Settings",
      "Bank accounts",
      "Compte joint",
    ]);
  });
});
