import { describe, expect, it } from "bun:test";

import { docsUrl, releaseNotesUrl, updateGuideUrl } from "./docs";

describe("docsUrl", () => {
  it("opens the docs of a release, and next for any other build", () => {
    expect(docsUrl("1.2.3")).toBe("https://freenary.dev/docs/1.2");
    expect(docsUrl("dev")).toBe("https://freenary.dev/docs/next");
    expect(docsUrl("")).toBe("https://freenary.dev/docs/next");
  });
});

describe("update links", () => {
  it("opens the update guide of the release on offer", () => {
    expect(updateGuideUrl("0.2.0")).toBe(
      "https://freenary.dev/docs/0.2/run/updates-and-backups"
    );
  });

  it("opens the notes of the release tag", () => {
    expect(releaseNotesUrl("0.2.0")).toBe(
      "https://github.com/suiramdev/freenary/releases/tag/v0.2.0"
    );
  });
});
