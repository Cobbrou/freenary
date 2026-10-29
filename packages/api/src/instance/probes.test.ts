import { describe, expect, it } from "bun:test";

import { capProbeDetail } from "./probes";

const ASTRAL_CHARACTER = String.fromCodePoint(0x1_d4_00);

describe("capProbeDetail", () => {
  it("keeps a short detail whole", () => {
    expect(capProbeDetail("401 Unauthorized")).toBe("401 Unauthorized");
  });

  it("keeps at most 300 characters of a long body", () => {
    expect(capProbeDetail("x".repeat(1000))).toHaveLength(300);
  });

  it("never splits a character outside the basic plane", () => {
    const capped = capProbeDetail(ASTRAL_CHARACTER.repeat(400));

    expect([...capped]).toHaveLength(300);
    expect(capped).toBe(ASTRAL_CHARACTER.repeat(300));
  });
});
