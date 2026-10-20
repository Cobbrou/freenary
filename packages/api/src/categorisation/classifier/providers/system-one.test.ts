import { describe, expect, it } from "bun:test";

import { categoriesForDirection } from "../../../lib/taxonomy";
import type { ClassificationInput, ClassifierTransport } from "../types";
import type { SystemOneSettings } from "./system-one";
import { createSystemOneClassifier } from "./system-one";

interface ChoiceAnswer {
  certainty?: number;
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  type: "choice";
}

interface RecordedCall {
  authorization: string | null;
  body: {
    model: string;
    questions: Record<
      string,
      { criteria?: Record<string, string>; type?: string } | undefined
    >;
    state: ClassificationInput;
  };
  url: string;
}

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

const ANSWERED_BY = "decider-v10";

const hosted: SystemOneSettings = {
  apiKey: "k",
  model: "decider-2b-v10",
  temperature: 1,
  url: "https://api.typesafe.ai/v1/systemone",
};

const choice = (picked: string, confidence: number): ChoiceAnswer => ({
  choice: picked,
  confidence,
  probabilities: { [picked]: confidence },
  type: "choice",
});

const answering =
  (
    answers: Record<string, ChoiceAnswer>,
    calls: RecordedCall[] = []
  ): ClassifierTransport =>
  (url, init) => {
    calls.push({
      authorization: new Headers(init.headers).get("Authorization"),
      body: JSON.parse(String(init.body)),
      url,
    });

    return Promise.resolve(
      Response.json({ answers, model: ANSWERED_BY, usage: {} })
    );
  };

const refusing =
  (status: number): ClassifierTransport =>
  () =>
    Promise.resolve(new Response("rate limited", { status }));

describe("createSystemOneClassifier", () => {
  it("asks one question over the payload, offering only what the direction allows", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("bills-utilities", 0.8) }, calls)
    );

    await classifier.classify(payload);

    const [call] = calls;

    expect(call?.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(call?.authorization).toBe("Bearer k");
    expect(call?.body.model).toBe("decider-2b-v10");
    expect(call?.body.state).toEqual(payload);
    expect(Object.keys(call?.body.questions ?? {})).toEqual(["category"]);
    expect(call?.body.questions.category?.type).toBe("choice");
    expect(Object.keys(call?.body.questions.category?.criteria ?? {})).toEqual([
      ...categoriesForDirection("outgoing"),
    ]);
  });

  it("offers the incoming categories on a credit", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("salary", 0.8) }, calls)
    );

    await classifier.classify({ ...payload, direction: "credit" });

    expect(
      Object.keys(calls[0]?.body.questions.category?.criteria ?? {})
    ).toEqual([...categoriesForDirection("incoming")]);
  });

  it("describes every offered category rather than naming it", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("bills-utilities", 0.8) }, calls)
    );

    await classifier.classify(payload);

    for (const rubric of Object.values(
      calls[0]?.body.questions.category?.criteria ?? {}
    )) {
      expect(rubric.split(" ").length).toBeGreaterThan(3);
    }
  });

  it("reports the answer's own confidence", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("bills-utilities", 0.8) })
    );

    expect(await classifier.classify(payload)).toEqual({
      answeredBy: ANSWERED_BY,
      category: "bills-utilities",
      confidence: 0.8,
    });
  });

  it("posts to a self-hosted endpoint with no key and carries its own provider name", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createSystemOneClassifier(
      {
        apiKey: undefined,
        model: "decider-0.8b",
        temperature: 1,
        url: "http://decider:8000/v1/systemone",
      },
      answering({ category: choice("bills-utilities", 0.8) }, calls)
    );

    expect(classifier.provider).toBe("system-one");
    expect(classifier.model).toBe("decider-0.8b");

    await classifier.classify(payload);

    expect(calls[0]?.url).toBe("http://decider:8000/v1/systemone");
    expect(calls[0]?.authorization).toBeNull();
    expect(calls[0]?.body.model).toBe("decider-0.8b");
  });

  it("prefers the answer's own concentration over its argmax probability", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({
        category: { ...choice("bills-utilities", 0.92), certainty: 0.61 },
      })
    );

    expect(await classifier.classify(payload)).toEqual({
      answeredBy: ANSWERED_BY,
      category: "bills-utilities",
      confidence: 0.61,
    });
  });

  it("recomputes the confidence from the distribution when a temperature is fitted", async () => {
    const spread = {
      ...choice("bills-utilities", 0.55),
      certainty: 0.99,
      probabilities: { "bills-utilities": 0.55, subscriptions: 0.45 },
    };

    const sharp = createSystemOneClassifier(
      hosted,
      answering({ category: spread })
    );

    const flattened = createSystemOneClassifier(
      { ...hosted, temperature: 3 },
      answering({ category: spread })
    );

    expect(await sharp.classify(payload)).toMatchObject({ confidence: 0.99 });

    const softened = await flattened.classify(payload);

    expect(softened?.confidence).toBeLessThan(0.9);
    expect(softened?.category).toBe("bills-utilities");
  });

  it("abstains when the answer is below the acceptance bar", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("bills-utilities", 0.4) })
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("abstains when the model says no category fits", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("uncategorised", 0.95) })
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("fails on a category the direction does not allow", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("groceries", 0.95) })
    );

    await expect(
      classifier.classify({ ...payload, direction: "credit" })
    ).rejects.toThrow(/cannot take: groceries/u);
  });

  it("fails on a category this taxonomy does not hold", async () => {
    const classifier = createSystemOneClassifier(
      hosted,
      answering({ category: choice("household-supplies", 0.95) })
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      /cannot take: household-supplies/u
    );
  });

  it("fails when the answer is missing", async () => {
    const classifier = createSystemOneClassifier(hosted, answering({}));

    await expect(classifier.classify(payload)).rejects.toThrow(
      /no category answer/u
    );
  });

  it("answers from a body that carries no distribution", async () => {
    const classifier = createSystemOneClassifier(
      { ...hosted, model: "laya-typed-decisions" },
      () =>
        Promise.resolve(
          Response.json({
            answers: {
              category: { choice: "bills-utilities", confidence: 0.9 },
            },
            model: "laya-typed-decisions",
          })
        )
    );

    expect(await classifier.classify(payload)).toEqual({
      answeredBy: "laya-typed-decisions",
      category: "bills-utilities",
      confidence: 0.9,
    });
  });

  it("fails with the status and the body when the endpoint refuses", async () => {
    const classifier = createSystemOneClassifier(hosted, refusing(429));

    await expect(classifier.classify(payload)).rejects.toThrow(
      /refused the classification: 429 rate limited/u
    );
  });

  it("fails with the decode reason when the answer is not the documented shape", async () => {
    const classifier = createSystemOneClassifier(hosted, () =>
      Promise.resolve(
        new Response("not json", {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      /outside the documented shape: .*JSON Parse error/u
    );
  });

  it("fails when the network is unreachable", async () => {
    const classifier = createSystemOneClassifier(hosted, () =>
      Promise.reject(new Error("ECONNREFUSED"))
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      /unreachable: .*ECONNREFUSED/u
    );
  });
});
