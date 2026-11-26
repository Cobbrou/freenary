import { describe, expect, it } from "bun:test";

import { firstNameOf, fullNameOf } from "./person-name";

describe("person name", () => {
  it("reads Better Auth's name as the first name", () => {
    expect(firstNameOf({ lastName: "Nouchet", name: "Marius" })).toBe("Marius");

    expect(firstNameOf(null)).toBe("");
  });

  it("joins the first and last name", () => {
    expect(fullNameOf({ lastName: "Nouchet", name: "Marius" })).toBe(
      "Marius Nouchet"
    );

    expect(fullNameOf({ lastName: null, name: "Marius" })).toBe("Marius");

    expect(fullNameOf(null)).toBeUndefined();
  });
});
