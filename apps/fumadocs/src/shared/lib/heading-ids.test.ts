import { describe, expect, it } from "bun:test";

import { withoutHeadingIds } from "./heading-ids";

describe("withoutHeadingIds", () => {
  it("drops the id fumadocs appends to each heading", () => {
    expect(
      withoutHeadingIds("## Before you start [#before-you-start]\n\nText")
    ).toBe("## Before you start\n\nText");
  });

  it("keeps a bracket that is not a heading id", () => {
    expect(withoutHeadingIds("Run [this](#steps) [#x] now")).toBe(
      "Run [this](#steps) [#x] now"
    );
  });
});
