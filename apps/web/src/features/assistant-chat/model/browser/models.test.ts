import { describe, expect, it } from "bun:test";

import { defaultBrowserModel } from "./models";

const model = (id: string, vramMb: number) => ({ id, label: id, vramMb });

describe("defaultBrowserModel", () => {
  it("prefers Qwen3 4B", () => {
    expect(
      defaultBrowserModel([
        model("Qwen3-1.7B-q4f16_1-MLC", 2000),
        model("Qwen3.5-4B-q4f16_1-MLC", 3300),
        model("Qwen3-4B-q4f16_1-MLC", 3400),
      ])?.id
    ).toBe("Qwen3-4B-q4f16_1-MLC");
  });

  it("falls back to the first model of the catalog", () => {
    expect(
      defaultBrowserModel([model("Qwen3-1.7B-q4f32_1-MLC", 2500)])?.id
    ).toBe("Qwen3-1.7B-q4f32_1-MLC");
  });

  it("has no default for an empty catalog", () => {
    expect(defaultBrowserModel([])).toBeNull();
  });
});
