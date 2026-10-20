import { describe, expect, it } from "bun:test";

import { Option, Result } from "effect";

import type { ClassifierChain, ClassifierSlotSettings } from "./registry";
import { createClassifierChain } from "./registry";

const unset: ClassifierSlotSettings = {
  apiKey: undefined,
  model: undefined,
  protocol: undefined,
  temperature: 1,
  url: undefined,
};

const decider: ClassifierSlotSettings = {
  apiKey: undefined,
  model: "decider-2b-v10",
  protocol: "system-one",
  temperature: 1,
  url: "http://decider:8000/v1/systemone",
};

const ollama: ClassifierSlotSettings = {
  apiKey: undefined,
  model: "qwen3:8b",
  protocol: "llm",
  temperature: 1,
  url: "http://ollama:11434/v1",
};

const failureOf = (created: ClassifierChain) =>
  Option.getOrThrow(Result.getFailure(created));

describe("createClassifierChain", () => {
  it("calls no model when no protocol is configured", () => {
    const created = createClassifierChain({
      fallback: unset,
      primary: unset,
    });

    expect(Result.getOrThrow(created)).toEqual([]);
  });

  it("builds one classifier per protocol from one slot shape", () => {
    const [systemOne] = Result.getOrThrow(
      createClassifierChain({ fallback: unset, primary: decider })
    );

    const [llm] = Result.getOrThrow(
      createClassifierChain({ fallback: unset, primary: ollama })
    );

    const [zeroShot] = Result.getOrThrow(
      createClassifierChain({
        fallback: unset,
        primary: {
          ...unset,
          model: "ModernBERT-large-zeroshot-v2.0",
          protocol: "zero-shot",
          url: "http://nli:8080/classify",
        },
      })
    );

    expect(systemOne?.provider).toBe("system-one");
    expect(systemOne?.model).toBe("decider-2b-v10");
    expect(llm?.provider).toBe("llm");
    expect(zeroShot?.provider).toBe("zero-shot");
  });

  it("refuses a slot with no endpoint", () => {
    const created = createClassifierChain({
      fallback: unset,
      primary: { ...decider, url: undefined },
    });

    expect(Result.isFailure(created)).toBe(true);
    expect(failureOf(created)).toMatchObject({
      message:
        "TRANSACTION_CLASSIFIER=system-one requires TRANSACTION_CLASSIFIER_URL to be set.",
      variable: "TRANSACTION_CLASSIFIER_URL",
    });
  });

  it("refuses a slot with no model, whatever the protocol", () => {
    const created = createClassifierChain({
      fallback: unset,
      primary: { ...ollama, model: undefined },
    });

    expect(failureOf(created)).toMatchObject({
      message:
        "TRANSACTION_CLASSIFIER=llm requires TRANSACTION_CLASSIFIER_MODEL to be set.",
      variable: "TRANSACTION_CLASSIFIER_MODEL",
    });
  });

  it("names the fallback slot in its own refusal", () => {
    const created = createClassifierChain({
      fallback: { ...ollama, url: undefined },
      primary: decider,
    });

    expect(failureOf(created)).toMatchObject({
      message:
        "TRANSACTION_CLASSIFIER_FALLBACK=llm requires TRANSACTION_CLASSIFIER_FALLBACK_URL to be set.",
      variable: "TRANSACTION_CLASSIFIER_FALLBACK_URL",
    });
  });

  it("orders the chain, asking the primary before the fallback", () => {
    const chain = Result.getOrThrow(
      createClassifierChain({ fallback: ollama, primary: decider })
    );

    expect(chain.map((classifier) => classifier.provider)).toEqual([
      "system-one",
      "llm",
    ]);
  });

  it("escalates one protocol to another endpoint of the same protocol", () => {
    const chain = Result.getOrThrow(
      createClassifierChain({
        fallback: {
          apiKey: "ts-key",
          model: "jev-latest",
          protocol: "system-one",
          temperature: 1,
          url: "https://api.typesafe.ai/v1/systemone",
        },
        primary: decider,
      })
    );

    expect(chain.map((classifier) => classifier.model)).toEqual([
      "decider-2b-v10",
      "jev-latest",
    ]);
  });

  it("refuses a fallback with no classifier before it", () => {
    const created = createClassifierChain({
      fallback: ollama,
      primary: unset,
    });

    expect(failureOf(created)).toMatchObject({
      variable: "TRANSACTION_CLASSIFIER",
    });
  });

  it("refuses a fallback that repeats the protocol and the model", () => {
    const created = createClassifierChain({
      fallback: { ...decider, url: "http://other:8000/v1/systemone" },
      primary: decider,
    });

    expect(failureOf(created)).toMatchObject({
      variable: "TRANSACTION_CLASSIFIER_FALLBACK",
    });
  });
});
