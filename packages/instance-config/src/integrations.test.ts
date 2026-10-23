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

  test("reads the Ollama endpoint as the local model only when remembered", () => {
    const ollama = {
      TRANSACTION_CLASSIFIER: "llm",
      TRANSACTION_CLASSIFIER_URL: "http://ollama:11434/v1",
    };

    expect(recognised(categorisation, ollama)).toBe("llm");
    expect(
      recognised(categorisation, {
        ...ollama,
        "variant:categorisation": "ollama",
      })
    ).toBe("ollama");
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

  test("lists Von and Laya only when an instance already uses them", () => {
    expect(listed("jev")).not.toContain("von");
    expect(listed("jev")).not.toContain("laya");
    expect(listed("von")).toContain("von");
    expect(listed("von")).not.toContain("laya");
    expect(listed("laya")).toContain("laya");
  });
});
