import { describe, expect, test } from "bun:test";

import { Option } from "effect";

import type { HeldValue, Integration } from "./integrations";
import {
  findIntegration,
  instanceConfigurableKeys,
  recogniseVariant,
  rememberedVariantKey,
} from "./integrations";

const categorisation: Integration = Option.getOrThrow(
  findIntegration("categorisation")
);

const assistant: Integration = Option.getOrThrow(findIntegration("assistant"));

const holding =
  (values: Readonly<Record<string, string>>): HeldValue =>
  (key) =>
    values[key];

const recognised = (
  integration: Integration,
  values: Readonly<Record<string, string>>
): string | undefined =>
  Option.getOrUndefined(
    recogniseVariant(
      integration,
      holding(values),
      values[rememberedVariantKey(integration)]
    )
  )?.id;

describe("recogniseVariant", () => {
  test("reads an unset classifier as the disabled variant", () => {
    expect(recognised(categorisation, {})).toBe("disabled");
  });

  test("recognises Jev and SubQ Snap by the endpoint they post to", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "system-one",
        TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
      })
    ).toBe("jev");

    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "system-one",
        TRANSACTION_CLASSIFIER_URL: "https://api.subq.ai/v1/systemone",
      })
    ).toBe("subq-snap");
  });

  test("reads any other system-one endpoint as the generic server", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "system-one",
        TRANSACTION_CLASSIFIER_URL: "http://von:8000/v1/systemone",
      })
    ).toBe("system-one");
  });

  test("recognises a self-hosted model only from the remembered choice", () => {
    const von = {
      TRANSACTION_CLASSIFIER: "system-one",
      TRANSACTION_CLASSIFIER_URL: "http://von:8000/v1/systemone",
    };

    expect(
      recognised(categorisation, { ...von, "variant:categorisation": "von" })
    ).toBe("von");

    expect(
      recognised(categorisation, { ...von, "variant:categorisation": "laya" })
    ).toBe("laya");
  });

  test("ignores a remembered choice the held values contradict", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "llm",
        TRANSACTION_CLASSIFIER_URL: "http://ollama:11434/v1",
        "variant:categorisation": "von",
      })
    ).toBe("llm");
  });

  test("reads a vendor endpoint as that vendor whatever was remembered", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "system-one",
        TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
        "variant:categorisation": "von",
      })
    ).toBe("jev");
  });

  test("reads any assistant endpoint as the OpenAI-compatible variant", () => {
    expect(recognised(assistant, {})).toBe("disabled");
    expect(
      recognised(assistant, { AI_BASE_URL: "https://openrouter.ai/api/v1" })
    ).toBe("openai-compatible");
  });
});

describe("instanceConfigurableKeys", () => {
  test("hands the primary classifier slot and the assistant to the screen", () => {
    for (const key of [
      "AI_API_KEY",
      "AI_BASE_URL",
      "AI_MODEL",
      "TRANSACTION_CLASSIFIER",
      "TRANSACTION_CLASSIFIER_API_KEY",
      "TRANSACTION_CLASSIFIER_MODEL",
      "TRANSACTION_CLASSIFIER_URL",
    ] as const) {
      expect(instanceConfigurableKeys.has(key)).toBe(true);
    }

    expect(
      instanceConfigurableKeys.has("TRANSACTION_CLASSIFIER_FALLBACK")
    ).toBe(false);
  });
});
