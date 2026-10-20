import { describe, expect, it } from "bun:test";

import { CATEGORY_CRITERIA, offeredCategories } from "../questions";
import type { ClassificationInput, ClassifierTransport } from "../types";
import type { ZeroShotSettings } from "./zero-shot";
import { createZeroShotClassifier } from "./zero-shot";

interface RecordedCall {
  authorization: string | null;
  body: {
    inputs: string;
    parameters: {
      candidate_labels: string[];
      hypothesis_template: string;
      multi_label: boolean;
    };
  };
  url: string;
}

type ScoredResponse =
  | { labels: string[]; scores: number[] }
  | { label: string; score: number }[];

const settings: ZeroShotSettings = {
  apiKey: "hf_key",
  model: "MoritzLaurer/ModernBERT-large-zeroshot-v2.0",
  temperature: 1,
  url: "https://o7vf1.eu-west-1.aws.endpoints.huggingface.cloud",
};

const payload: ClassificationInput = {
  amountBucket: "small",
  channel: "card",
  counterpartyName: "EDF",
  country: "FR",
  currency: "EUR",
  direction: "debit",
  merchantCategoryCode: null,
  merchantKey: "edf",
  normalisedDescriptor: "edf paiement",
  path: "card",
};

const debitRubrics = offeredCategories("debit").map(
  (category) => CATEGORY_CRITERIA[category]
);

const creditRubrics = offeredCategories("credit").map(
  (category) => CATEGORY_CRITERIA[category]
);

const PEAKED_TOP_SCORE = 0.97;
const FLAT_TOP_SCORE = 0.06;

const distribution = (
  picked: string,
  top: number,
  rubrics: readonly string[] = debitRubrics
) => {
  const labels = [picked, ...rubrics.filter((rubric) => rubric !== picked)];
  const rest = (1 - top) / (labels.length - 1);

  return {
    labels,
    scores: labels.map((_, index) => (index === 0 ? top : rest)),
  } satisfies ScoredResponse;
};

const answering =
  (body: ScoredResponse, calls: RecordedCall[] = []): ClassifierTransport =>
  (url, init) => {
    calls.push({
      authorization: new Headers(init.headers).get("Authorization"),
      body: JSON.parse(String(init.body)),
      url,
    });

    return Promise.resolve(Response.json(body));
  };

const refusing =
  (status: number): ClassifierTransport =>
  () =>
    Promise.resolve(new Response("rate limited", { status }));

describe("createZeroShotClassifier", () => {
  it("posts the state to the given URL with the direction's rubrics as candidate labels", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE),
        calls
      )
    );

    await classifier.classify(payload);

    const [call] = calls;

    expect(call?.url).toBe(
      "https://o7vf1.eu-west-1.aws.endpoints.huggingface.cloud"
    );

    expect(call?.authorization).toBe("Bearer hf_key");
    expect(call?.body.parameters.candidate_labels).toEqual([...debitRubrics]);
    expect(call?.body.parameters.multi_label).toBe(false);
    expect(call?.body.parameters.hypothesis_template).toBe(
      "This bank transaction is: {}."
    );
  });

  it("offers the incoming rubrics on a credit", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA.salary, PEAKED_TOP_SCORE, creditRubrics),
        calls
      )
    );

    await classifier.classify({ ...payload, direction: "credit" });

    expect(calls[0]?.body.parameters.candidate_labels).toEqual([
      ...creditRubrics,
    ]);

    expect(calls[0]?.body.parameters.candidate_labels).not.toEqual([
      ...debitRubrics,
    ]);
  });

  it("sends no authorization header when the operator configured no key", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      { ...settings, apiKey: undefined },
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE),
        calls
      )
    );

    await classifier.classify(payload);

    expect(calls[0]?.authorization).toBeNull();
  });

  it("sends no authorization header for an empty key", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      { ...settings, apiKey: "" },
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE),
        calls
      )
    );

    await classifier.classify(payload);

    expect(calls[0]?.authorization).toBeNull();
  });

  it("states the descriptor and the counterparty, and no amount, date or account", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE),
        calls
      )
    );

    await classifier.classify(payload);

    expect(calls[0]?.body.inputs).toBe(
      "edf paiement | EDF | card | small | EUR | FR"
    );
  });

  it("leaves out the facts the transaction does not carry", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE),
        calls
      )
    );

    await classifier.classify({
      ...payload,
      counterpartyName: null,
      country: null,
      merchantCategoryCode: "5411",
    });

    await classifier.classify({
      ...payload,
      counterpartyName: "",
      country: null,
      merchantCategoryCode: "5411",
    });

    expect(calls[0]?.body.inputs).toBe(
      "edf paiement | 5411 | card | small | EUR"
    );

    expect(calls[1]?.body.inputs).toBe(
      "edf paiement | 5411 | card | small | EUR"
    );
  });

  it("answers the category whose rubric scored highest", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], PEAKED_TOP_SCORE)
      )
    );

    const prediction = await classifier.classify(payload);

    expect(prediction?.category).toBe("bills-utilities");
    expect(prediction?.answeredBy).toBe(
      "MoritzLaurer/ModernBERT-large-zeroshot-v2.0"
    );

    expect(prediction?.confidence).toBeGreaterThan(0.85);
  });

  it("weighs a short answer against every category the direction offers", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering({
        labels: debitRubrics.slice(0, 3),
        scores: [PEAKED_TOP_SCORE, 0.015, 0.015],
      })
    );

    const prediction = await classifier.classify(payload);

    expect(prediction?.confidence).toBeGreaterThan(0.9);
  });

  it("maps every offered rubric back to its own category", async () => {
    const expected = offeredCategories("debit").filter(
      (category) => category !== "uncategorised"
    );

    const predictions = await Promise.all(
      expected.map((category) =>
        createZeroShotClassifier(
          settings,
          answering(distribution(CATEGORY_CRITERIA[category], PEAKED_TOP_SCORE))
        ).classify(payload)
      )
    );

    expect(predictions.map((prediction) => prediction?.category)).toEqual([
      ...expected,
    ]);
  });

  it("holds one rubric per category, in both directions", () => {
    expect(new Set(debitRubrics).size).toBe(debitRubrics.length);
    expect(new Set(creditRubrics).size).toBe(creditRubrics.length);
  });

  it("decodes the flat array shape into the same prediction", async () => {
    const peaked = distribution(
      CATEGORY_CRITERIA["bills-utilities"],
      PEAKED_TOP_SCORE
    );

    const asStruct = createZeroShotClassifier(settings, answering(peaked));
    const asArray = createZeroShotClassifier(
      settings,
      answering(
        peaked.labels.map((label, index) => ({
          label,
          score: peaked.scores[index] ?? 0,
        }))
      )
    );

    const fromStruct = await asStruct.classify(payload);
    const fromArray = await asArray.classify(payload);

    expect(fromStruct?.category).toBe("bills-utilities");
    expect(fromArray).toEqual(fromStruct);
  });

  it("abstains when the distribution is near flat over every rubric", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(CATEGORY_CRITERIA["bills-utilities"], FLAT_TOP_SCORE)
      )
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("rejects when the top label is not one of the rubrics sent", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering(distribution("groceries", PEAKED_TOP_SCORE))
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      "answered with a label this transaction cannot take: groceries"
    );
  });

  it("abstains when the top rubric is the one that says nothing fits", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering(distribution(CATEGORY_CRITERIA.uncategorised, PEAKED_TOP_SCORE))
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("rejects on a rubric the direction does not offer", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering(
        distribution(
          CATEGORY_CRITERIA.groceries,
          PEAKED_TOP_SCORE,
          creditRubrics
        )
      )
    );

    await expect(
      classifier.classify({ ...payload, direction: "credit" })
    ).rejects.toThrow(
      `answered with a label this transaction cannot take: ${CATEGORY_CRITERIA.groceries}`
    );
  });

  it("rejects when the endpoint refuses the request", async () => {
    const classifier = createZeroShotClassifier(settings, refusing(429));

    await expect(classifier.classify(payload)).rejects.toThrow(
      "the endpoint refused the classification: 429 rate limited"
    );
  });

  it("rejects when the body is not JSON", async () => {
    const classifier = createZeroShotClassifier(settings, () =>
      Promise.resolve(
        new Response("not json", {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      "the endpoint answered outside the documented shape"
    );
  });

  it("rejects when the labels and the scores differ in length", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering({ labels: [...debitRubrics], scores: [1] })
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      `outside the documented shape: ${debitRubrics.length} labels against 1 scores`
    );
  });

  it("rejects when the endpoint offers no label at all", async () => {
    const classifier = createZeroShotClassifier(
      settings,
      answering({ labels: [], scores: [] })
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      "outside the documented shape: 0 labels against 0 scores"
    );
  });

  it("rejects when the endpoint is unreachable", async () => {
    const classifier = createZeroShotClassifier(settings, () =>
      Promise.reject(new Error("ECONNREFUSED"))
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      "the endpoint is unreachable: Error: ECONNREFUSED"
    );
  });

  it("lowers the reported confidence as the operator raises the temperature", async () => {
    const peaked = distribution(
      CATEGORY_CRITERIA["bills-utilities"],
      PEAKED_TOP_SCORE
    );

    const neutral = await createZeroShotClassifier(
      settings,
      answering(peaked)
    ).classify(payload);

    const warmed = await createZeroShotClassifier(
      { ...settings, temperature: 1.4 },
      answering(peaked)
    ).classify(payload);

    expect(neutral?.confidence).toBeGreaterThan(0);
    expect(warmed?.confidence).toBeGreaterThan(0);
    expect(warmed?.confidence ?? 1).toBeLessThan(neutral?.confidence ?? 0);
  });
});
