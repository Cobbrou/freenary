import { describe, expect, it } from "bun:test";

import type { ResolutionResult } from "../categorisation/types";
import {
  isLowConfidence,
  lowConfidenceTransactionIds,
} from "./transactions-to-check";

const resolution = (
  overrides: Partial<ResolutionResult>
): ResolutionResult => ({
  band: "suggest",
  category: "shopping",
  confidence: 0.6,
  intermediaryName: null,
  merchantName: null,
  stage: "model",
  ...overrides,
});

describe("isLowConfidence", () => {
  it("flags a classifier answer under the auto band, cached or not", () => {
    expect(isLowConfidence(resolution({}))).toBe(true);
    expect(isLowConfidence(resolution({ stage: "cached-model" }))).toBe(true);
  });

  it("leaves a confident classifier answer alone", () => {
    expect(isLowConfidence(resolution({ band: "auto", confidence: 0.9 }))).toBe(
      false
    );
  });

  it("leaves categories from rules, the dictionary and corrections alone", () => {
    expect(isLowConfidence(resolution({ stage: "rules" }))).toBe(false);
    expect(isLowConfidence(resolution({ stage: "dictionary" }))).toBe(false);
    expect(isLowConfidence(resolution({ stage: "user-override" }))).toBe(false);
  });

  it("flags nothing that has no category", () => {
    expect(
      isLowConfidence(
        resolution({ band: "unknown", category: null, stage: "none" })
      )
    ).toBe(false);
  });
});

describe("lowConfidenceTransactionIds", () => {
  it("keeps the transactions whose resolution is low confidence, in order", () => {
    expect(
      lowConfidenceTransactionIds(
        ["a", "b", "c", "d"],
        [
          resolution({}),
          resolution({ band: "auto", confidence: 0.95 }),
          undefined,
          resolution({ stage: "cached-model" }),
        ]
      )
    ).toEqual(["a", "d"]);
  });
});
