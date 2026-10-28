import { describe, expect, test } from "bun:test";

import { escapeLikePattern } from "./like-pattern";

describe("escapeLikePattern", () => {
  test("escapes the LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern(String.raw`50%_off\now`)).toBe(
      String.raw`50\%\_off\\now`
    );
  });

  test("leaves plain text unchanged", () => {
    expect(escapeLikePattern("Carrefour Market")).toBe("Carrefour Market");
  });
});
