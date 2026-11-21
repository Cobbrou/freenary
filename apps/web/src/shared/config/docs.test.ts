import { describe, expect, it } from "bun:test";

import { docsUrl, releaseNotesUrl, updateGuideUrl } from "./docs";

describe("docsUrl", () => {
  it("opens the documentation home", () => {
    expect(docsUrl()).toBe("https://freenary.dev/docs");
  });
});

describe("update links", () => {
  it("opens the update guide", () => {
    expect(updateGuideUrl()).toBe(
      "https://freenary.dev/docs/how-to/update-freenary"
    );
  });

  it("opens the notes of the release tag", () => {
    expect(releaseNotesUrl("0.2.0")).toBe(
      "https://github.com/suiramdev/freenary/releases/tag/v0.2.0"
    );
  });
});
