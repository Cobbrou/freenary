import type { ServerSettings } from "@freenary/instance-config/candidate";
import type { ProbeFailureReason } from "@freenary/instance-config/probe";
import { IntegrationProbeFailed } from "@freenary/instance-config/probe";
import { Effect, Result } from "effect";

import { createClassifierChain, primarySlotOf } from "./registry";
import type { ClassificationInput, ClassifierTransport } from "./types";

const CATEGORISATION_INTEGRATION = "categorisation";

export const PROBE_TRANSACTION: ClassificationInput = {
  amountBucket: "small",
  channel: "card",
  counterpartyName: null,
  country: "FR",
  currency: "EUR",
  direction: "debit",
  merchantCategoryCode: null,
  merchantKey: "carrefour market",
  normalisedDescriptor: "carrefour market paris",
  path: "card",
};

type RecordedAnswer = ReturnType<Response["clone"]>;

const recordingTransport = (send: ClassifierTransport) => {
  const answers: RecordedAnswer[] = [];

  const transport: ClassifierTransport = async (url, init) => {
    const response = await send(url, init);

    answers.push(response.clone());

    return response;
  };

  return { answers, transport };
};

const reasonFor = Effect.fnUntraced(function* reasonFor(
  answer: RecordedAnswer | undefined,
  detail: string
) {
  if (answer === undefined) {
    return { detail, kind: "unreachable" } satisfies ProbeFailureReason;
  }

  if (answer.ok) {
    return { detail, kind: "invalid" } satisfies ProbeFailureReason;
  }

  const body = yield* Effect.tryPromise({
    catch: String,
    try: () => answer.text(),
  }).pipe(Effect.orElseSucceed(() => ""));

  return {
    detail: body,
    kind: "rejected",
    status: answer.status,
  } satisfies ProbeFailureReason;
});

const probeFailure = (
  variantId: string,
  reason: ProbeFailureReason
): IntegrationProbeFailed =>
  new IntegrationProbeFailed({
    integrationId: CATEGORISATION_INTEGRATION,
    reason,
    variantId,
  });

export const probeClassifier = (
  variantId: string,
  send: ClassifierTransport = fetch
) =>
  Effect.fn("categorisation.probe")(function* probeEndpoint(
    candidate: ServerSettings
  ) {
    const recorder = recordingTransport(send);
    const primary = primarySlotOf(candidate);
    const chain = createClassifierChain(
      { fallback: { ...primary, protocol: undefined }, primary },
      recorder.transport
    );

    if (Result.isFailure(chain)) {
      return yield* probeFailure(variantId, {
        detail: chain.failure.message,
        kind: "invalid",
      });
    }

    const [classifier] = chain.success;

    if (classifier === undefined) {
      return;
    }

    const answered = yield* Effect.result(
      Effect.tryPromise({
        catch: String,
        try: () => classifier.classify(PROBE_TRANSACTION),
      })
    );

    if (Result.isSuccess(answered)) {
      return;
    }

    const reason = yield* reasonFor(recorder.answers.at(-1), answered.failure);

    return yield* probeFailure(variantId, reason);
  });
