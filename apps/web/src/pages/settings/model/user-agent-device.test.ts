import { describe, expect, it } from "bun:test";

import { deviceSlugFromUserAgent } from "./user-agent-device";

describe("deviceSlugFromUserAgent", () => {
  it("names the desktop platforms", () => {
    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
      )
    ).toBe("mac");

    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      )
    ).toBe("windows");

    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0"
      )
    ).toBe("linux");
  });

  it("prefers the narrower family over the Linux and Mac strings it contains", () => {
    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
      )
    ).toBe("android");

    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      )
    ).toBe("chromebook");

    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iphone");

    expect(
      deviceSlugFromUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
      )
    ).toBe("ipad");
  });

  it("falls back to unknown for a missing or unrecognised header", () => {
    expect(deviceSlugFromUserAgent()).toBe("unknown");
    expect(deviceSlugFromUserAgent(null)).toBe("unknown");
    expect(deviceSlugFromUserAgent("")).toBe("unknown");
    expect(deviceSlugFromUserAgent("curl/8.4.0")).toBe("unknown");
  });
});
