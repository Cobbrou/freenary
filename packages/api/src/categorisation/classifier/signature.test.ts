import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

import { TAXONOMY_VERSION } from "../../lib/taxonomy";
import { classificationSignature, payloadSignature } from "./signature";
import type { ClassificationInput, TransactionClassifier } from "./types";

const classifier: Pick<TransactionClassifier, "provider" | "model"> = {
  model: "decider-2b-v10",
  provider: "system-one",
};

const payload: ClassificationInput = {
  amountBucket: "small",
  channel: "card",
  counterpartyName: "CARREFOUR MARKET",
  country: "FR",
  currency: "EUR",
  direction: "debit",
  merchantCategoryCode: null,
  merchantKey: "carrefour market",
  normalisedDescriptor: "carrefour market paris",
  path: "card",
};

describe("classificationSignature", () => {
  it("hashes the merchant identity, the classifier and the taxonomy version", () => {
    const expected = createHash("sha256")
      .update(
        JSON.stringify([
          "system-one",
          "decider-2b-v10",
          TAXONOMY_VERSION,
          "carrefour market",
          "FR",
          "debit",
          null,
        ])
      )
      .digest("hex");

    expect(classificationSignature(classifier, payload)).toBe(expected);
  });

  it("changes when the taxonomy version moves", () => {
    const nextVersion = createHash("sha256")
      .update(
        JSON.stringify([
          "system-one",
          "decider-2b-v10",
          TAXONOMY_VERSION + 1,
          "carrefour market",
          "FR",
          "debit",
          null,
        ])
      )
      .digest("hex");

    expect(classificationSignature(classifier, payload)).not.toBe(nextVersion);
  });

  it("ignores the amount, the currency, the channel and the counterparty", () => {
    const other: ClassificationInput = {
      ...payload,
      amountBucket: "large",
      channel: "transfer",
      counterpartyName: null,
      currency: "SEK",
      normalisedDescriptor: "carrefour market lyon",
      path: "iban",
    };

    expect(classificationSignature(classifier, other)).toBe(
      classificationSignature(classifier, payload)
    );
  });

  it("separates a different merchant identity, country, direction or code", () => {
    const signature = classificationSignature(classifier, payload);

    expect(
      classificationSignature(classifier, { ...payload, merchantKey: "lidl" })
    ).not.toBe(signature);

    expect(
      classificationSignature(classifier, { ...payload, country: "SE" })
    ).not.toBe(signature);

    expect(
      classificationSignature(classifier, { ...payload, direction: "credit" })
    ).not.toBe(signature);

    expect(
      classificationSignature(classifier, {
        ...payload,
        merchantCategoryCode: "5411",
      })
    ).not.toBe(signature);
  });

  it("separates a different provider or model", () => {
    const signature = classificationSignature(classifier, payload);

    expect(
      classificationSignature(
        { model: "decider-2b-v10", provider: "llm" },
        payload
      )
    ).not.toBe(signature);

    expect(
      classificationSignature(
        { model: "decider-0.8b", provider: "system-one" },
        payload
      )
    ).not.toBe(signature);
  });

  it("falls back to the descriptor when there is no merchant key", () => {
    const keyless: ClassificationInput = { ...payload, merchantKey: null };
    const asKey: ClassificationInput = {
      ...payload,
      merchantKey: payload.normalisedDescriptor,
    };

    expect(classificationSignature(classifier, keyless)).toBe(
      classificationSignature(classifier, asKey)
    );
  });
});

describe("payloadSignature", () => {
  it("groups a merchant whatever classifier the chain names", () => {
    expect(payloadSignature(payload)).toBe(payloadSignature(payload));
    expect(payloadSignature(payload)).not.toBe(
      classificationSignature(classifier, payload)
    );

    expect(payloadSignature(payload)).not.toBe(
      classificationSignature(
        { model: "decider-2b-v10", provider: "system-one" },
        payload
      )
    );
  });

  it("separates a different merchant identity", () => {
    expect(payloadSignature(payload)).not.toBe(
      payloadSignature({ ...payload, merchantKey: "monoprix" })
    );

    expect(payloadSignature(payload)).not.toBe(
      payloadSignature({ ...payload, direction: "credit" })
    );
  });
});
