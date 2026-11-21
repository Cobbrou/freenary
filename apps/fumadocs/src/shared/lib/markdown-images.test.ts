import { describe, expect, it } from "bun:test";

import {
  imageTargetsOf,
  resolveRelativePath,
  withMarkdownImages,
} from "./markdown-images";

describe("imageTargetsOf", () => {
  it("lists image targets in order and skips code fences", () => {
    expect(
      imageTargetsOf(
        "![a](../images/one.png)\n\n```text\n![b](skip.png)\n```\n\n   ![c](../images/two.png)"
      )
    ).toEqual(["../images/one.png", "../images/two.png"]);
  });
});

describe("resolveRelativePath", () => {
  it("resolves a target against the page file", () => {
    expect(
      resolveRelativePath("tutorials/get-it-running.md", "../images/one.png")
    ).toBe("images/one.png");
  });
});

describe("withMarkdownImages", () => {
  it("turns fumadocs image placeholders back into Markdown images", () => {
    expect(
      withMarkdownImages(
        'Text\n\n   <img alt="A &quot;quoted&quot; screen" src="__img1" />',
        ["../images/zero.png", "../images/one.png"],
        (target) => `https://example.com/${target}`
      )
    ).toBe(
      'Text\n\n   ![A "quoted" screen](https://example.com/../images/one.png)'
    );
  });

  it("keeps a tag it cannot map", () => {
    expect(withMarkdownImages('<img src="__img4" />', [], String)).toBe(
      '<img src="__img4" />'
    );
  });
});
