import { describe, expect, it } from "bun:test";

import { settings } from "@freenary/instance-config";
import type { ServerSettings } from "@freenary/instance-config/candidate";
import { Option } from "effect";

import { createJevSuggester } from "./suggest";
import type { ClassifierTransport } from "./types";

const jev: ServerSettings = {
  ...settings,
  TRANSACTION_CLASSIFIER: "system-one",
  TRANSACTION_CLASSIFIER_API_KEY: "ts-key",
  TRANSACTION_CLASSIFIER_MODEL: "jev-latest",
  TRANSACTION_CLASSIFIER_TEMPERATURE: 1,
  TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
};

const subqSnap: ServerSettings = {
  ...jev,
  TRANSACTION_CLASSIFIER_MODEL: "subq-snap-1.1",
  TRANSACTION_CLASSIFIER_URL: "https://api.subq.ai/v1/systemone",
};

const disabled: ServerSettings = {
  ...settings,
  TRANSACTION_CLASSIFIER: undefined,
  TRANSACTION_CLASSIFIER_FALLBACK: undefined,
};

const noStoredSettings: Record<string, string> = {};

const nothingRemembered = (variantKey: string) => noStoredSettings[variantKey];

interface RecordedCall {
  body: {
    state: {
      currency: string;
      direction: string;
      merchantKey: string | null;
      normalisedDescriptor: string;
    };
  };
  url: string;
}

const answering =
  (
    category: Record<string, string | number | Record<string, number>>,
    calls: RecordedCall[] = []
  ): ClassifierTransport =>
  (url, init) => {
    calls.push({ body: JSON.parse(String(init.body)), url });

    return Promise.resolve(
      Response.json({ answers: { category }, model: "jev-1.13.0" })
    );
  };

const suggesterFor = (
  candidate: ServerSettings,
  transport: ClassifierTransport = answering({})
) => createJevSuggester(candidate, nothingRemembered, transport);

describe("createJevSuggester", () => {
  it("offers suggestions when Jev classifies transactions", () => {
    expect(Option.isSome(suggesterFor(jev))).toBe(true);
  });

  it("offers none when categorisation is off", () => {
    expect(Option.isNone(suggesterFor(disabled))).toBe(true);
  });

  it("offers none for another hosted classifier", () => {
    expect(Option.isNone(suggesterFor(subqSnap))).toBe(true);
  });

  it("ranks the offered categories by probability, best first", async () => {
    const calls: RecordedCall[] = [];
    const suggester = Option.getOrThrow(
      suggesterFor(
        jev,
        answering(
          {
            choice: "groceries",
            confidence: 0.7,
            probabilities: {
              groceries: 0.7,
              restaurants: 0.01,
              salary: 0.2,
              shopping: 0.15,
              uncategorised: 0.1,
            },
          },
          calls
        )
      )
    );

    const suggested = await suggester.suggest({
      currency: "EUR",
      direction: "debit",
      query: "Carrefour Market",
    });

    expect(suggested).toEqual(["groceries", "shopping"]);
    expect(calls[0]?.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(calls[0]?.body.state.merchantKey).toBe("carrefour market");
  });

  it("sends the typed text normalised into the merchant fields", async () => {
    const calls: RecordedCall[] = [];
    const suggester = Option.getOrThrow(
      suggesterFor(
        jev,
        answering({ choice: "restaurants", confidence: 0.9 }, calls)
      )
    );

    await suggester.suggest({
      currency: "EUR",
      direction: "debit",
      query: "Café Lumière",
    });

    expect(calls[0]?.body.state).toMatchObject({
      currency: "EUR",
      direction: "debit",
      merchantKey: "cafe lumiere",
      normalisedDescriptor: "cafe lumiere",
    });
  });

  it("keeps the top three", async () => {
    const suggester = Option.getOrThrow(
      suggesterFor(
        jev,
        answering({
          choice: "groceries",
          confidence: 0.4,
          probabilities: {
            entertainment: 0.1,
            groceries: 0.4,
            restaurants: 0.2,
            shopping: 0.3,
          },
        })
      )
    );

    expect(
      await suggester.suggest({
        currency: "EUR",
        direction: "debit",
        query: "market",
      })
    ).toEqual(["groceries", "shopping", "restaurants"]);
  });

  it("falls back to the single choice without probabilities", async () => {
    const suggester = Option.getOrThrow(
      suggesterFor(jev, answering({ choice: "salary", confidence: 0.9 }))
    );

    expect(
      await suggester.suggest({
        currency: "EUR",
        direction: "credit",
        query: "acme payroll",
      })
    ).toEqual(["salary"]);
  });

  it("asks nothing for text that carries no merchant", async () => {
    const calls: RecordedCall[] = [];
    const suggester = Option.getOrThrow(
      suggesterFor(jev, answering({}, calls))
    );

    expect(
      await suggester.suggest({
        currency: "EUR",
        direction: "debit",
        query: "  12345 ",
      })
    ).toEqual([]);

    expect(calls).toEqual([]);
  });

  it("rejects when the endpoint refuses", async () => {
    const suggester = Option.getOrThrow(
      suggesterFor(jev, () =>
        Promise.resolve(new Response("rate limited", { status: 429 }))
      )
    );

    const suggested = suggester.suggest({
      currency: "EUR",
      direction: "debit",
      query: "carrefour",
    });

    await expect(suggested).rejects.toThrow("429");
  });
});
