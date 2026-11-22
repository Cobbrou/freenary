import { describe, expect, it } from "bun:test";

import { resolveModelChoice, SERVER_MODEL } from "./model-choice";

const DEVICE = "Qwen3-4B-q4f16_1-MLC";

describe("resolveModelChoice", () => {
  it("keeps a device model the member picked", () => {
    expect(
      resolveModelChoice("Llama-3.2-3B-Instruct-q4f16_1-MLC", "gpt", DEVICE)
    ).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
  });

  it("uses the server model when the instance has one", () => {
    expect(resolveModelChoice(null, "gpt", DEVICE)).toBe(SERVER_MODEL);
    expect(resolveModelChoice(SERVER_MODEL, "gpt", DEVICE)).toBe(SERVER_MODEL);
  });

  it("falls back to the device default without a server model", () => {
    expect(resolveModelChoice(null, null, DEVICE)).toBe(DEVICE);
    expect(resolveModelChoice(SERVER_MODEL, null, DEVICE)).toBe(DEVICE);
  });

  it("has no choice without a server model or a device default", () => {
    expect(resolveModelChoice(null, null, null)).toBeNull();
  });
});
