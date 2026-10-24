import { describe, expect, test } from "bun:test";

import { Option } from "effect";

import type { HeldValue, Integration } from "./integrations";
import {
  findIntegration,
  findVariant,
  instanceConfigurableKeys,
  integrations,
  isListedFor,
  isRequiredForSetup,
  isShownInSetup,
  recogniseVariant,
  rememberedVariantKey,
  setupIntegrations,
} from "./integrations";

const categorisation: Integration = Option.getOrThrow(
  findIntegration("categorisation")
);

const assistant: Integration = Option.getOrThrow(findIntegration("assistant"));

const banking: Integration = Option.getOrThrow(findIntegration("banking"));

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

  test("reads a choice saved through the former Ollama option as the OpenAI-compatible endpoint", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "llm",
        TRANSACTION_CLASSIFIER_MODEL: "qwen3:4b-instruct-2507-q4_K_M",
        TRANSACTION_CLASSIFIER_URL: "http://ollama:11434/v1",
        "variant:categorisation": "ollama",
      })
    ).toBe("llm");
  });

  test("reads the classifiers no longer offered as before", () => {
    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "system-one",
        TRANSACTION_CLASSIFIER_URL: "http://decider:8000/v1/systemone",
      })
    ).toBe("system-one");

    expect(
      recognised(categorisation, {
        TRANSACTION_CLASSIFIER: "zero-shot",
        TRANSACTION_CLASSIFIER_URL: "http://zero-shot:8000",
      })
    ).toBe("zero-shot");
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

const roleOf = (id: string) => {
  const integration = Option.getOrThrow(findIntegration(id));

  return {
    required: isRequiredForSetup(integration),
    shown: isShownInSetup(integration),
  };
};

describe("setup roles", () => {
  test("requires the bank and lets categories be skipped", () => {
    expect(roleOf("banking")).toEqual({ required: true, shown: true });
    expect(roleOf("categorisation")).toEqual({ required: false, shown: true });
  });

  test("leaves email and the assistant out of setup", () => {
    expect(roleOf("email")).toEqual({ required: false, shown: false });
    expect(roleOf("assistant")).toEqual({ required: false, shown: false });
  });

  test("orders the setup steps bank first, then categories", () => {
    expect(setupIntegrations.map((integration) => integration.id)).toEqual([
      "banking",
      "categorisation",
    ]);
  });

  test("keeps every integration and its off variant defined", () => {
    expect(integrations.map((integration) => integration.id)).toEqual([
      "banking",
      "email",
      "assistant",
      "categorisation",
    ]);

    for (const integration of integrations) {
      expect(Option.isSome(findVariant(integration, "disabled"))).toBe(true);
    }
  });
});

describe("recommended", () => {
  test("recommends Powens and no other bank provider", () => {
    const recommended = banking.variants.flatMap((variant) =>
      variant.recommended === true ? [variant.id] : []
    );

    expect(recommended).toEqual(["powens"]);
  });
});

const categorisationVariant = (id: string) =>
  Option.getOrThrow(findVariant(categorisation, id));

const suggestionOf = (variantId: string, key: string): string | undefined =>
  categorisationVariant(variantId).fields.find((field) => field.key === key)
    ?.suggestion;

const listed = (selected: string): string[] =>
  categorisation.variants.flatMap((variant) =>
    isListedFor(variant, selected) ? [variant.id] : []
  );

describe("categorisation variants", () => {
  test("recommends Jev and SubQ Snap and no other model", () => {
    const recommended = categorisation.variants.flatMap((variant) =>
      variant.recommended === true ? [variant.id] : []
    );

    expect(recommended).toEqual(["jev", "subq-snap"]);
  });

  test("suggests the released SubQ Snap model", () => {
    expect(suggestionOf("subq-snap", "TRANSACTION_CLASSIFIER_MODEL")).toBe(
      "subq-snap-1.1"
    );
  });

  test("offers Jev, SubQ Snap and an OpenAI-compatible endpoint", () => {
    expect(listed("jev")).toEqual(["disabled", "jev", "subq-snap", "llm"]);
    expect(listed("disabled")).toEqual(["disabled", "jev", "subq-snap", "llm"]);
  });

  test("lists a classifier no longer offered only while it is the one in use", () => {
    for (const legacy of ["von", "laya", "system-one", "zero-shot"]) {
      expect(listed("llm")).not.toContain(legacy);
      expect(listed(legacy)).toEqual([
        "disabled",
        "jev",
        "subq-snap",
        "llm",
        legacy,
      ]);
    }
  });

  test("leaves the OpenAI-compatible endpoint empty for any server", () => {
    expect(suggestionOf("llm", "TRANSACTION_CLASSIFIER_URL")).toBeUndefined();
    expect(suggestionOf("llm", "TRANSACTION_CLASSIFIER_MODEL")).toBeUndefined();
  });

  test("no longer defines a separate Ollama option", () => {
    expect(Option.isNone(findVariant(categorisation, "ollama"))).toBe(true);
  });
});
