import { describe, expect, it } from "bun:test";

import { isBannerShown } from "./update-dismissal";

const NOT_READ_YET: string | null | undefined = undefined;

describe("isBannerShown", () => {
  it("shows a newer release the operator has not dismissed", () => {
    expect(isBannerShown("1.3.0", null)).toBe(true);
  });

  it("hides it from a member, who is sent no release", () => {
    expect(isBannerShown(null, null)).toBe(false);
  });

  it("hides it once that release is dismissed", () => {
    expect(isBannerShown("1.3.0", "1.3.0")).toBe(false);
  });

  it("shows it again for a release newer than the dismissed one", () => {
    expect(isBannerShown("1.4.0", "1.3.0")).toBe(true);
  });

  it("waits for the browser before showing anything", () => {
    expect(isBannerShown("1.3.0", NOT_READ_YET)).toBe(false);
  });
});
