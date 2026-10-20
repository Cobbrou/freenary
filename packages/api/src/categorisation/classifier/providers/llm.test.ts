import { describe, expect, it } from "bun:test";

import { ACCEPT_CONFIDENCE, UNDISTRIBUTED_CONFIDENCE } from "../confidence";
import { offeredCategories } from "../questions";
import type { ClassificationInput, ClassifierTransport } from "../types";
import type { LlmSettings } from "./llm";
import { createLlmClassifier } from "./llm";

interface TopLogprob {
  logprob: number;
  token: string;
}

interface CompletionBody {
  choices: {
    logprobs: { content: { top_logprobs: TopLogprob[] }[] } | null;
    message: { content: string };
  }[];
  model: string | null;
}

interface RecordedCall {
  authorization: string | null;
  body: {
    logprobs?: boolean;
    max_tokens?: number;
    messages?: { content: string; role: string }[];
    model?: string;
    temperature?: number;
    top_logprobs?: number;
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

const ANSWERED_BY = "qwen3:8b-instruct";
const BILLS_UTILITIES_LETTER = "H";
const UNCATEGORISED_DEBIT_LETTER = "T";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const settings: LlmSettings = {
  apiKey: "sk-test",
  model: "qwen3:8b",
  temperature: 1,
  url: "https://openrouter.ai/api/v1/",
};

const completion = (
  topLogprobs: TopLogprob[] | null,
  content: string,
  model: string | null = ANSWERED_BY
): CompletionBody => ({
  choices: [
    {
      logprobs:
        topLogprobs === null
          ? null
          : { content: [{ top_logprobs: topLogprobs }] },
      message: { content },
    },
  ],
  model,
});

const spread = (winner: string, letterCount: number, runnerUpLogprob: number) =>
  Array.from({ length: letterCount }, (_, index) => {
    const letter = ALPHABET.charAt(index);

    return {
      logprob: letter === winner ? -0.001 : runnerUpLogprob,
      token: ` ${letter}`,
    };
  });

const answering =
  (body: CompletionBody, calls: RecordedCall[] = []): ClassifierTransport =>
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

describe("createLlmClassifier", () => {
  it("posts the letter question to the endpoint's chat-completions path", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createLlmClassifier(
      settings,
      answering(completion(spread(BILLS_UTILITIES_LETTER, 20, -12), "H"), calls)
    );

    await classifier.classify(payload);

    const [call] = calls;

    expect(call?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call?.authorization).toBe("Bearer sk-test");
    expect(call?.body.model).toBe("qwen3:8b");
    expect(call?.body.logprobs).toBe(true);
    expect(call?.body.top_logprobs).toBe(20);
    expect(call?.body.temperature).toBe(0);
    expect(call?.body.max_tokens).toBe(2);
    expect(call?.body.messages?.[0]?.role).toBe("system");
    expect(call?.body.messages?.[0]?.content).toContain("(H) bills-utilities");
    expect(call?.body.messages?.[1]).toEqual({
      content: JSON.stringify(payload),
      role: "user",
    });
  });

  it("sends no bearer header when the endpoint carries no key", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createLlmClassifier(
      { ...settings, apiKey: undefined, url: "http://localhost:11434/v1" },
      answering(completion(null, "H"), calls)
    );

    await classifier.classify(payload);

    expect(calls[0]?.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(calls[0]?.authorization).toBeNull();
  });

  it("sends no bearer header when the configured key is empty", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createLlmClassifier(
      { ...settings, apiKey: "" },
      answering(completion(null, "H"), calls)
    );

    await classifier.classify(payload);

    expect(calls[0]?.authorization).toBeNull();
  });

  it("reads a peaked distribution as a confident category", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(completion(spread(BILLS_UTILITIES_LETTER, 20, -12), "H"))
    );

    const prediction = await classifier.classify(payload);

    expect(prediction?.category).toBe("bills-utilities");
    expect(prediction?.answeredBy).toBe(ANSWERED_BY);
    expect(prediction?.confidence).toBeGreaterThan(0.85);
  });

  it("abstains when the distribution is flat over the offered letters", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(
        completion(
          Array.from({ length: 20 }, (_, index) => ({
            logprob: -3,
            token: ALPHABET.charAt(index),
          })),
          "H"
        )
      )
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("offers only the incoming categories on a credit", async () => {
    const calls: RecordedCall[] = [];
    const classifier = createLlmClassifier(
      settings,
      answering(completion(spread("A", 10, -12), "A"), calls)
    );

    const prediction = await classifier.classify({
      ...payload,
      direction: "credit",
    });

    expect(calls[0]?.body.top_logprobs).toBe(
      offeredCategories("credit").length
    );

    expect(calls[0]?.body.messages?.[0]?.content).toContain("(A) salary");
    expect(calls[0]?.body.messages?.[0]?.content).not.toContain("groceries");
    expect(prediction?.category).toBe("salary");
  });

  it("rejects on a letter the direction does not offer", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(completion(null, "M"))
    );

    await expect(
      classifier.classify({ ...payload, direction: "credit" })
    ).rejects.toThrow(/letter this transaction cannot take: M/u);
  });

  it("folds a token's spacing and case into its option letter", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(
        completion(
          [
            { logprob: -0.2, token: " h" },
            { logprob: -1, token: "zz" },
          ],
          "E"
        )
      )
    );

    const prediction = await classifier.classify(payload);

    expect(prediction?.category).toBe("bills-utilities");
  });

  it("reads the written letter as a suggestion when no distribution comes back", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(completion(null, "H"))
    );

    expect(await classifier.classify(payload)).toEqual({
      answeredBy: ANSWERED_BY,
      category: "bills-utilities",
      confidence: UNDISTRIBUTED_CONFIDENCE,
    });
  });

  it("falls back to the configured model when the answer names none", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(completion(null, "H", null))
    );

    const prediction = await classifier.classify(payload);

    expect(prediction?.answeredBy).toBe("qwen3:8b");
  });

  it("abstains when the letter means no category fits", async () => {
    const classifier = createLlmClassifier(
      settings,
      answering(completion(spread(UNCATEGORISED_DEBIT_LETTER, 20, -12), "T"))
    );

    expect(await classifier.classify(payload)).toBeNull();
  });

  it("rejects with the status and the body when the endpoint refuses", async () => {
    const classifier = createLlmClassifier(settings, refusing(429));

    await expect(classifier.classify(payload)).rejects.toThrow(
      /refused the classification: 429 rate limited/u
    );
  });

  it("rejects with the decode reason when the answer is not the documented shape", async () => {
    const classifier = createLlmClassifier(settings, () =>
      Promise.resolve(
        new Response("not json", {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      /outside the chat-completions shape: \w*Error: .*JSON/u
    );
  });

  it("rejects with the cause when the endpoint is unreachable", async () => {
    const classifier = createLlmClassifier(settings, () =>
      Promise.reject(new Error("ECONNREFUSED"))
    );

    await expect(classifier.classify(payload)).rejects.toThrow(
      /unreachable: Error: ECONNREFUSED/u
    );
  });

  it("reports less confidence for the same answer at a higher calibration temperature", async () => {
    const distribution = [
      { logprob: -0.001, token: " H" },
      { logprob: -8, token: " G" },
      { logprob: -9, token: " E" },
    ];

    const neutral = await createLlmClassifier(
      settings,
      answering(completion(distribution, "H"))
    ).classify(payload);

    const flattened = await createLlmClassifier(
      { ...settings, temperature: 4 },
      answering(completion(distribution, "H"))
    ).classify(payload);

    expect(neutral?.category).toBe("bills-utilities");
    expect(flattened?.category).toBe("bills-utilities");
    expect(flattened?.confidence).toBeLessThan(neutral?.confidence ?? 0);
    expect(flattened?.confidence).toBeGreaterThanOrEqual(ACCEPT_CONFIDENCE);
  });
});
