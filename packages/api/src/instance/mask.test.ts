import { expect, test } from "bun:test";

import { maskEnvironmentValue } from "./mask";

test("keeps four characters on each side of a long value", () => {
  expect(maskEnvironmentValue("client-1234567890abcd")).toBe("clie…abcd");
});

test("hides a value of eight characters in full", () => {
  expect(maskEnvironmentValue("12345678")).toBe("…");
});

test("hides an empty value in full", () => {
  expect(maskEnvironmentValue("")).toBe("…");
});
