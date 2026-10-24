import { describe, expect, it } from "bun:test";

import { settings } from "@freenary/instance-config";
import type { ServerSettings } from "@freenary/instance-config/candidate";
import { Effect, Result } from "effect";

import { probeClassifier } from "./probe";
import type { ClassifierTransport } from "./types";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonBody = Readonly<Record<string, JsonValue>>;

const jevCandidate: ServerSettings = {
  ...settings,
  TRANSACTION_CLASSIFIER: "system-one",
  TRANSACTION_CLASSIFIER_API_KEY: "ts-key",
  TRANSACTION_CLASSIFIER_MODEL: "jev-latest",
  TRANSACTION_CLASSIFIER_TEMPERATURE: 1,
  TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
};

const answering =
  (status: number, body: JsonBody): ClassifierTransport =>
  () =>
    Promise.resolve(Response.json(body, { status }));

const probe = (send: ClassifierTransport, candidate = jevCandidate) =>
  Effect.runPromise(Effect.result(probeClassifier("jev", send)(candidate)));

describe("probeClassifier", () => {
  it("passes when the endpoint answers the sample merchant", async () => {
    const outcome = await probe(
      answering(200, {
        answers: {
          category: {
            choice: "groceries",
            confidence: 0.9,
            probabilities: { groceries: 0.95, shopping: 0.05 },
            type: "choice",
          },
        },
        model: "jev-1.13.0",
      })
    );

    expect(Result.isSuccess(outcome)).toBe(true);
  });

  it("reports the status and body of a refused key", async () => {
    const outcome = await probe(
      answering(401, { detail: { error_type: "unauthorized" } })
    );

    expect(outcome).toMatchObject({
      failure: {
        integrationId: "categorisation",
        reason: { kind: "rejected", status: 401 },
        variantId: "jev",
      },
    });
  });

  it("reports an endpoint that never answers as unreachable", async () => {
    const outcome = await probe(() =>
      Promise.reject(new TypeError("fetch failed"))
    );

    expect(outcome).toMatchObject({
      failure: { reason: { kind: "unreachable" } },
    });
  });

  it("names the time limit and its variable when the endpoint is too slow", async () => {
    const outcome = await probe(
      () =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError")
        ),
      { ...jevCandidate, TRANSACTION_CLASSIFIER_TIMEOUT_MS: 30_000 }
    );

    const reason = Result.isFailure(outcome) ? outcome.failure.reason : null;

    expect(reason?.kind).toBe("unreachable");
    expect(JSON.stringify(reason)).toContain(
      "no answer within 30 s. Raise TRANSACTION_CLASSIFIER_TIMEOUT_MS to wait longer."
    );
  });

  it("reports an answer outside the documented shape as invalid", async () => {
    const outcome = await probe(answering(200, { unexpected: true }));

    expect(outcome).toMatchObject({
      failure: { reason: { kind: "invalid" } },
    });
  });

  it("reports a slot with no model as invalid before calling anything", async () => {
    const outcome = await probe(answering(200, {}), {
      ...jevCandidate,
      TRANSACTION_CLASSIFIER_MODEL: undefined,
    });

    expect(outcome).toMatchObject({
      failure: { reason: { kind: "invalid" } },
    });
  });
});
