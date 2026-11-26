import { describe, expect, test } from "bun:test";

import {
  betterAuthUserOf,
  fullNameOf,
  personNameOfProfile,
  splitFullName,
} from "./person-name";

describe("splitFullName", () => {
  test.each([
    ["Marius", { firstName: "Marius", lastName: null }],
    ["Marius Nouchet", { firstName: "Marius", lastName: "Nouchet" }],
    [
      "  Jean   Pierre  Dupont ",
      { firstName: "Jean", lastName: "Pierre Dupont" },
    ],
    ["Hélène de la Tour", { firstName: "Hélène", lastName: "de la Tour" }],
    ["", { firstName: "", lastName: null }],
    [null, { firstName: "", lastName: null }],
  ] as const)("splits %p at its first space", (fullName, expected) => {
    expect(splitFullName(fullName)).toEqual(expected);
  });

  test("gives back the full name, spaces collapsed", () => {
    expect(fullNameOf(splitFullName(" Jean  Pierre Dupont"))).toBe(
      "Jean Pierre Dupont"
    );

    expect(fullNameOf(splitFullName("Marius"))).toBe("Marius");
  });
});

describe("personNameOfProfile", () => {
  test("reads the given and family names of an OpenID profile", () => {
    expect(
      personNameOfProfile({
        family_name: "Nouchet",
        given_name: "Marius",
        name: "Marius B. Nouchet",
      })
    ).toEqual({ firstName: "Marius", lastName: "Nouchet" });

    expect(personNameOfProfile({ given_name: "Marius" })).toEqual({
      firstName: "Marius",
      lastName: null,
    });
  });

  test("splits the full name when the profile gives no given name", () => {
    expect(personNameOfProfile({ name: "Marius Nouchet" })).toEqual({
      firstName: "Marius",
      lastName: "Nouchet",
    });

    expect(personNameOfProfile({ given_name: " ", name: null })).toEqual({
      firstName: "",
      lastName: null,
    });
  });

  test("hands Better Auth the first name as its name", () => {
    expect(
      betterAuthUserOf({ family_name: "Nouchet", given_name: "Marius" })
    ).toEqual({ lastName: "Nouchet", name: "Marius" });
  });
});
